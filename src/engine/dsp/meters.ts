import type { ModuleSpec } from '../../modules/types'
import { ANAL, TUNERL } from '../../modules/specs/meters'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { DECIM, HOP, Yin } from './tune'
import { C4 } from './util'

/** Full-rate history for refining the period, and the window compared. */
const RING = 4096
const REFINE_WIN = 1024

/** TUNER: YIN on a 4× decimated copy (as AUDIO IN does) finds the period
 *  roughly; a few full-rate lags around it pin it down (high notes have only a
 *  handful of decimated samples per cycle). The frequency is smoothed in
 *  cents while the note holds and snaps when it jumps. */
export class TunerDsp extends Dsp {
  private readonly ring = new Float32Array(RING)
  private rw = 0
  private readonly iIn = this.ii('in')
  private readonly pRef = this.pi('ref')
  private readonly yin: Yin
  private lp = 0
  private dec = 0
  private decN = 0
  private hop = 0
  private env = 0
  /** Smoothed pitch, in semitones from A4 at 440 (NaN: nothing heard yet). */
  private semi = Number.NaN
  private voiced = false

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    // 40 Hz (a bass's low E is 41) up to 2.5 kHz (the refine step keeps the top accurate)
    this.yin = new Yin(Math.floor(fs / DECIM / 2500), Math.ceil(fs / DECIM / 40))
  }

  /** The period (full-rate samples) near `rough`: the lag where the signal
   *  best matches itself, interpolated between samples. */
  private refine(rough: number): number {
    const r = this.ring
    const end = this.rw
    let best = -1
    let bestD = Infinity
    let dPrev = 0
    let dBest0 = 0
    let dBest1 = 0
    const lo = Math.max(2, Math.floor(rough) - 3)
    const hi = Math.min(RING - REFINE_WIN - 2, Math.ceil(rough) + 3)
    for (let tau = lo - 1; tau <= hi + 1; tau++) {
      let d = 0
      for (let j = 0; j < REFINE_WIN; j++) {
        const i = (end - 1 - j + RING) & (RING - 1)
        const e = r[i] - r[(i - tau + RING) & (RING - 1)]
        d += e * e
      }
      if (tau > lo - 1 && tau <= hi && d < bestD) {
        bestD = d
        best = tau
        dBest0 = dPrev
      }
      if (tau === best + 1) dBest1 = d
      dPrev = d
    }
    if (best < 0) return rough
    const den = dBest0 - 2 * bestD + dBest1
    return best + (den > 0 ? (0.5 * (dBest0 - dBest1)) / den : 0)
  }

  tick(): void {
    const x = this.in[this.iIn]
    this.ring[this.rw] = x
    this.rw = (this.rw + 1) & (RING - 1)
    const a = Math.abs(x)
    this.env += (a - this.env) * (a > this.env ? 0.01 : 0.0003)
    this.lp += (x - this.lp) * 0.35
    this.dec += this.lp
    if (++this.decN >= DECIM) {
      this.yin.push(this.dec / DECIM)
      this.dec = this.decN = 0
      if (++this.hop >= HOP) {
        this.hop = 0
        const period = this.env > 0.03 ? this.yin.detect() : 0
        this.voiced = period > 0
        if (this.voiced) {
          const s = 12 * Math.log2(this.fs / this.refine(period * DECIM) / 440)
          // hold steady on a note; a new note snaps straight there
          this.semi = Number.isNaN(this.semi) || Math.abs(s - this.semi) > 0.5 ? s : this.semi + (s - this.semi) * 0.35
        }
      }
    }
    const ref = this.p[this.pRef]
    const hz = Number.isNaN(this.semi) ? 0 : 440 * Math.pow(2, this.semi / 12)
    // the note against the chosen A4
    const note = hz > 0 ? 69 + 12 * Math.log2(hz / ref) : 0
    const near = Math.round(note)
    this.out[0] = hz > 0 ? Math.log2(hz / C4) : 0
    this.out[1] = this.voiced ? 10 : 0
    this.led[TUNERL.note] = near
    this.led[TUNERL.cents] = (note - near) * 100
    this.led[TUNERL.voiced] = this.voiced ? 1 : 0
    this.led[TUNERL.hz] = hz
    this.led[TUNERL.level] = Math.min(1, this.env / 5)
  }
}

/** A biquad with its own coefficients (RBJ cookbook), for K-weighting. */
class Kq {
  private z1 = 0
  private z2 = 0
  constructor(
    private readonly b0: number,
    private readonly b1: number,
    private readonly b2: number,
    private readonly a1: number,
    private readonly a2: number,
  ) {}
  static shelf(fs: number, f0: number, db: number, q: number): Kq {
    const A = Math.pow(10, db / 40)
    const w = (2 * Math.PI * f0) / fs
    const al = Math.sin(w) / (2 * q)
    const c = Math.cos(w)
    const s = 2 * Math.sqrt(A) * al
    const a0 = A + 1 - (A - 1) * c + s
    return new Kq((A * (A + 1 + (A - 1) * c + s)) / a0, (-2 * A * (A - 1 + (A + 1) * c)) / a0, (A * (A + 1 + (A - 1) * c - s)) / a0, (2 * (A - 1 - (A + 1) * c)) / a0, (A + 1 - (A - 1) * c - s) / a0)
  }
  static highpass(fs: number, f0: number, q: number): Kq {
    const w = (2 * Math.PI * f0) / fs
    const al = Math.sin(w) / (2 * q)
    const c = Math.cos(w)
    const a0 = 1 + al
    return new Kq((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - al) / a0)
  }
  run(x: number): number {
    const y = this.b0 * x + this.z1
    this.z1 = this.b1 * x - this.a1 * y + this.z2
    this.z2 = this.b2 * x - this.a2 * y
    return y
  }
}

const BLOCKS = 30
const FFT = 4096
/** Integrated loudness histogram: 0.1 LU bins from −70 to +10 LUFS. */
const BIN0 = -70
const BINS = 800
const lufs = (e: number) => (e > 0 ? -0.691 + 10 * Math.log10(e) : -99)
const db = (v: number) => (v > 1e-6 ? 20 * Math.log10(v) : -99)

/** ANALYSER: loudness as BS.1770 measures it (K-weighted, 400 ms momentary,
 *  3 s short-term, integrated with the −70 LUFS and −10 LU gates, every
 *  100 ms), sample peaks, correlation, and the latest 4096 samples for the
 *  screen's spectrum. 5 V is full scale. Passes L / R through. */
export class AnalyserDsp extends Dsp {
  private readonly iL = this.ii('l')
  private readonly iR = this.ii('r')
  private readonly iRst = this.ii('rst')
  private readonly kL: Kq[]
  private readonly kR: Kq[]
  private readonly blockLen: number
  private n = 0
  private acc = 0
  private readonly blocks = new Float64Array(BLOCKS)
  private filled = 0
  private at = 0
  private readonly count = new Float64Array(BINS)
  private readonly energy = new Float64Array(BINS)
  private integrated = -99
  private pl = 0
  private pr = 0
  private max = 0
  private lr = 0
  private ll = 0
  private rr = 0
  private readonly ring = new Float32Array(FFT)
  private w = 0
  private readonly rst = new Schmitt()

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    const k = () => [Kq.shelf(fs, 1681.97, 3.99984, 0.7071752), Kq.highpass(fs, 38.1355, 0.500327)]
    this.kL = k()
    this.kR = k()
    this.blockLen = Math.round(0.1 * fs)
  }

  private reset(): void {
    this.count.fill(0)
    this.energy.fill(0)
    this.integrated = -99
    this.max = 0
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'reset' && ev.down) this.reset()
  }

  /** A 100 ms block is in: update momentary, short-term and integrated. */
  private block(): void {
    this.blocks[this.at] = this.acc / this.blockLen
    this.at = (this.at + 1) % BLOCKS
    this.filled = Math.min(BLOCKS, this.filled + 1)
    let m = 0
    let s = 0
    for (let k = 0; k < this.filled; k++) {
      const e = this.blocks[(this.at - 1 - k + BLOCKS) % BLOCKS]
      if (k < 4) m += e
      s += e
    }
    const mE = m / Math.min(4, this.filled)
    this.led[ANAL.m] = lufs(mE)
    this.led[ANAL.s] = lufs(s / this.filled)
    if (this.filled >= 4) {
      const L = lufs(mE)
      if (L > BIN0) {
        const b = Math.min(BINS - 1, Math.floor((L - BIN0) * 10))
        this.count[b]++
        this.energy[b] += mE
      }
      // the relative gate: 10 LU under the loudness of everything above −70
      let c = 0
      let e = 0
      for (let b = 0; b < BINS; b++) {
        c += this.count[b]
        e += this.energy[b]
      }
      if (c > 0) {
        const gate = lufs(e / c) - 10
        const g0 = Math.max(0, Math.ceil((gate - BIN0) * 10))
        c = 0
        e = 0
        for (let b = g0; b < BINS; b++) {
          c += this.count[b]
          e += this.energy[b]
        }
        this.integrated = c > 0 ? lufs(e / c) : -99
      }
    }
    this.led[ANAL.i] = this.integrated
  }

  tick(): void {
    if (this.rst.rise(this.in[this.iRst])) this.reset()
    const l = this.in[this.iL]
    const r = this.patched[this.iR] ? this.in[this.iR] : l
    this.out[0] = l
    this.out[1] = r
    const kl = this.kL[1].run(this.kL[0].run(l / 5))
    const kr = this.kR[1].run(this.kR[0].run(r / 5))
    this.acc += kl * kl + kr * kr
    if (++this.n >= this.blockLen) {
      this.block()
      this.n = 0
      this.acc = 0
    }
    // peaks hold, then fall about 20 dB a second
    const al = Math.abs(l) / 5
    const ar = Math.abs(r) / 5
    this.pl = al > this.pl ? al : this.pl * 0.99995
    this.pr = ar > this.pr ? ar : this.pr * 0.99995
    if (al > this.max) this.max = al
    if (ar > this.max) this.max = ar
    this.lr += (l * r - this.lr) * 0.0001
    this.ll += (l * l - this.ll) * 0.0001
    this.rr += (r * r - this.rr) * 0.0001
    this.ring[this.w] = (l + r) * 0.5
    this.w = (this.w + 1) % FFT
    this.led[ANAL.pl] = db(this.pl)
    this.led[ANAL.pr] = db(this.pr)
    this.led[ANAL.max] = db(this.max)
    this.led[ANAL.corr] = this.ll + this.rr > 1e-6 ? this.lr / Math.sqrt(this.ll * this.rr + 1e-9) : 0
  }

  takeFrame(): Float32Array | null {
    const f = new Float32Array(FFT)
    f.set(this.ring.subarray(this.w))
    f.set(this.ring.subarray(0, this.w), FFT - this.w)
    return f
  }
}
