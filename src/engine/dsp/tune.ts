import type { ModuleSpec } from '../../modules/types'
import { TUNEL } from '../../modules/specs/tune'
import { Dsp } from './base'
import { DelayLine } from './delayLine'
import { SCALES } from './shapers'
import { C4 } from './util'

/** Detection runs on a 4× decimated copy (12 kHz at 48 kHz). */
export const DECIM = 4
const WIN = 512
export const HOP = 64
const BUF = 2048
const YIN_THRESHOLD = 0.15

/** YIN pitch detector over a ring buffer of decimated samples. */
export class Yin {
  readonly x = new Float32Array(BUF)
  w = 0
  private readonly d: Float32Array
  private readonly lin: Float32Array
  constructor(
    private readonly minLag: number,
    private readonly maxLag: number,
  ) {
    this.d = new Float32Array(maxLag + 2)
    this.lin = new Float32Array(WIN + maxLag + 1)
  }
  push(v: number): void {
    this.x[this.w] = v
    this.w = (this.w + 1) % BUF
  }
  /** Returns the period in decimated samples, or 0 if unvoiced. */
  detect(): number {
    // Unroll the ring into a straight scratch copy so the inner loop has no modulo.
    const x = this.lin
    const start = (this.w - WIN - this.maxLag + BUF * 2) % BUF
    for (let j = 0; j < x.length; j++) x[j] = this.x[(start + j) % BUF]
    let sum = 0
    let best = 0
    let bestV = 1
    this.d[0] = 1
    for (let tau = 1; tau <= this.maxLag; tau++) {
      let acc = 0
      for (let j = 0; j < WIN; j++) {
        const e = x[j] - x[j + tau]
        acc += e * e
      }
      sum += acc
      const v = sum > 0 ? (acc * tau) / sum : 1
      this.d[tau] = v
      if (tau >= this.minLag && v < bestV) {
        bestV = v
        best = tau
      }
    }
    // First dip below the threshold beats the global minimum (avoids octave errors).
    for (let tau = this.minLag; tau < this.maxLag; tau++)
      if (this.d[tau] < YIN_THRESHOLD) {
        while (tau + 1 < this.maxLag && this.d[tau + 1] < this.d[tau]) tau++
        best = tau
        bestV = this.d[tau]
        break
      }
    if (bestV > 0.35 || best <= 0) return 0
    const a = this.d[best - 1]
    const b = this.d[best]
    const c = this.d[best + 1]
    const den = a - 2 * b + c
    return best + (den !== 0 ? (0.5 * (a - c)) / den : 0)
  }
}

/** Pitch corrector: detect, choose the target note, then shift with a pair of
 *  crossfaded delay taps whose window follows the detected period. */
export class TuneDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iV = this.ii('voct')
  private readonly pKey = this.pi('key')
  private readonly pScale = this.pi('scale')
  private readonly pSpeed = this.pi('speed')
  private readonly pMix = this.pi('mix')
  private readonly yin: Yin
  private readonly line: DelayLine
  private dec = 0
  private decN = 0
  private hop = 0
  private lp = 0
  private env = 0
  private heard = 0
  private goalNote = 0
  private voiced = false
  private ratio = 1
  private phase = 0
  private win = 0
  private readonly fsDec: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.fsDec = fs / DECIM
    this.yin = new Yin(Math.floor(this.fsDec / 1000), Math.ceil(this.fsDec / 70))
    this.line = new DelayLine(Math.ceil(0.08 * fs))
    this.win = Math.round(0.02 * fs)
  }

  private choose(volts: number): number {
    if (this.patched[this.iV]) return this.in[this.iV]
    const scale = SCALES[Math.round(this.p[this.pScale])] ?? SCALES[0]
    const key = Math.round(this.p[this.pKey])
    const semis = volts * 12 - key
    let best = Math.round(semis)
    let bestD = Infinity
    for (let n = Math.floor(semis) - 6; n <= Math.floor(semis) + 7; n++) {
      if (!scale.includes(((n % 12) + 12) % 12)) continue
      const d = Math.abs(n - semis)
      if (d < bestD) {
        bestD = d
        best = n
      }
    }
    return (best + key) / 12
  }

  tick(): void {
    const x = this.in[this.iIn]
    this.line.write(x)
    const a = Math.abs(x)
    this.env += (a - this.env) * (a > this.env ? 0.01 : 0.0005)

    // Decimate for the detector (low-pass, then keep every 4th).
    this.lp += (x - this.lp) * 0.35
    this.dec += this.lp
    if (++this.decN >= DECIM) {
      this.yin.push(this.dec / DECIM)
      this.dec = 0
      this.decN = 0
      if (++this.hop >= HOP) {
        this.hop = 0
        const period = this.env > 0.05 ? this.yin.detect() : 0
        this.voiced = period > 0
        if (this.voiced) {
          const f = this.fsDec / period
          this.heard = Math.log2(f / C4)
          this.goalNote = this.choose(this.heard)
          this.win = Math.min(Math.round(0.04 * this.fs), Math.max(Math.round(0.008 * this.fs), Math.round(2 * period * DECIM)))
        }
      }
    }

    // Glide the correction (SPEED 0 = instant: the hard-tune step).
    const want = this.voiced ? Math.pow(2, Math.max(-1, Math.min(1, this.goalNote - this.heard))) : 1
    const sp = this.p[this.pSpeed]
    this.ratio += (want - this.ratio) * (sp <= 0.001 ? 1 : 1 - Math.exp(-1 / (sp * this.fs)))

    // Two taps half a window apart, sin² crossfaded, sweeping at (1 − ratio).
    this.phase += (1 - this.ratio) / this.win
    this.phase -= Math.floor(this.phase)
    const p2 = (this.phase + 0.5) % 1
    const s1 = Math.sin(Math.PI * this.phase)
    const s2 = Math.sin(Math.PI * p2)
    const y = s1 * s1 * this.line.tapLin(2 + this.phase * this.win) + s2 * s2 * this.line.tapLin(2 + p2 * this.win)
    const mix = this.p[this.pMix]
    const o = this.out
    o[0] = x * (1 - mix) + y * mix
    o[1] = this.heard
    o[2] = this.goalNote
    o[3] = this.voiced ? 10 : 0
    this.led[TUNEL.heard] = this.heard
    this.led[TUNEL.target] = this.goalNote
    this.led[TUNEL.voiced] = this.voiced ? 1 : 0
  }
}
