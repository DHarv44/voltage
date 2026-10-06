import { Svf } from '../drumVoices'
import { TAU } from '../util'

export const FX_OFF = 0
const DELAY = 1
const CHORUS = 2
const PHONE = 3
const CRUSH = 4
/** DELAY's TIME knob: musical divisions, in 16th-note steps (1/16 … 1/2). */
const DIVS = [1, 2, 3, 4, 6, 8]
const MAX_S = 2.5

/** The sound's one effect (stereo out). A: TIME / RATE / TONE / BITS,
 *  B: FEEDBACK / DEPTH / DRIVE / RATE, by type. */
export class SketchFx {
  private readonly bufL: Float32Array
  private readonly bufR: Float32Array
  private w = 0
  private lpL = 0
  private lpR = 0
  private lfo = 0
  private readonly svf = new Svf()
  private held = 0
  private heldFor = 0
  readonly l = new Float32Array(1)
  readonly r = new Float32Array(1)

  constructor(private readonly fs: number) {
    const n = Math.round(MAX_S * fs)
    this.bufL = new Float32Array(n)
    this.bufR = new Float32Array(n)
  }

  /** Read `ago` samples back (fractional) from a buffer. */
  private tap(buf: Float32Array, ago: number): number {
    const n = buf.length
    const p = this.w - ago
    const i = Math.floor(p)
    const t = p - i
    const a = buf[((i % n) + n) % n]
    const b = buf[(((i + 1) % n) + n) % n]
    return a + (b - a) * t
  }

  /** One mono sample in; `l` / `r` hold the result. */
  process(x: number, type: number, mix: number, a: number, b: number, stepLen: number): void {
    const fs = this.fs
    let wl = x
    let wr = x
    if (type === DELAY) {
      // ping-pong: left feeds right feeds left, darker each time round
      const steps = DIVS[Math.min(DIVS.length - 1, Math.floor(a * DIVS.length))]
      const ago = Math.min(this.bufL.length - 2, steps * stepLen * fs)
      const dl = this.tap(this.bufL, ago)
      const dr = this.tap(this.bufR, ago)
      this.lpL += (dl - this.lpL) * 0.35
      this.lpR += (dr - this.lpR) * 0.35
      const fb = b * 0.85
      this.bufL[this.w] = x + this.lpR * fb
      this.bufR[this.w] = this.lpL * fb
      wl = x + dl * mix * 1.4
      wr = x + dr * mix * 1.4
      this.l[0] = wl
      this.r[0] = wr
      this.w = (this.w + 1) % this.bufL.length
      return
    }
    if (type === CHORUS) {
      // two taps swinging in quadrature: ensemble width
      this.lfo = (this.lfo + (0.1 + a * a * 5) / fs) % 1
      const depth = (0.5 + b * 7) * 0.001 * fs
      const base = 0.012 * fs
      this.bufL[this.w] = x
      wl = this.tap(this.bufL, base + depth * (1 + Math.sin(TAU * this.lfo)) * 0.5)
      wr = this.tap(this.bufL, base + depth * (1 + Math.cos(TAU * this.lfo)) * 0.5)
      this.w = (this.w + 1) % this.bufL.length
    } else if (type === PHONE) {
      // a telephone: 300 Hz–3.4 kHz, the TONE knob moves the band, DRIVE overdrives the line
      this.svf.process(x * (1 + b * 6), 600 + a * 2400, 1.1, fs)
      wl = wr = Math.tanh(this.svf.bp * 1.6)
    } else if (type === CRUSH) {
      const every = 1 + Math.floor(b * b * 30)
      if (--this.heldFor <= 0) {
        const q = Math.pow(2, 2 + (1 - a) * 12)
        this.held = Math.round(x * q) / q
        this.heldFor = every
      }
      wl = wr = this.held
    }
    this.l[0] = x * (1 - mix) + wl * mix
    this.r[0] = x * (1 - mix) + wr * mix
  }
}

/** The sound's LFO: SINE / TRIANGLE / SQUARE / RANDOM (stepped), −1..1. */
export class SketchLfo {
  private ph = 0
  private rnd = 0
  private seed = 0x2545f491

  step(shape: number, rate: number, fs: number): number {
    const prev = this.ph
    this.ph = (this.ph + rate / fs) % 1
    if (this.ph < prev) {
      let x = this.seed
      x ^= x << 13
      x ^= x >>> 17
      x ^= x << 5
      this.seed = x
      this.rnd = (x | 0) / 0x80000000
    }
    switch (shape) {
      case 1:
        return 1 - 4 * Math.abs(this.ph - 0.5)
      case 2:
        return this.ph < 0.5 ? 1 : -1
      case 3:
        return this.rnd
      default:
        return Math.sin(TAU * this.ph)
    }
  }
}
