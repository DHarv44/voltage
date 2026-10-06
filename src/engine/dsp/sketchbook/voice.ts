import { EnvCore } from '../cores'
import { Svf } from '../drumVoices'
import { C4, type Rng } from '../util'

/** Supersaw oscillators per voice. */
export const SAWS = 7
/** Karplus-Strong delay: enough for the lowest note (≈ 30 Hz at 48 kHz). */
export const KS_MAX = 2048

/** One sounding note, with state for every engine (a voice can change
 *  engine between notes; see engines.ts for what each one does with it). */
export class Voice {
  volts = 0
  vel = 1
  /** Samples left before a sequenced note lets go (−1: held until note off). */
  hold = -1
  gate = 0
  age = 0
  /** For stealing: when it started. */
  born = 0
  readonly env: EnvCore
  readonly ph = new Float64Array(SAWS + 1)
  mph = 0
  fb = 0
  readonly svf = new Svf()
  readonly ks = new Float32Array(KS_MAX)
  ksPos = 0
  ksLp = 0
  /** Sample-and-hold for the crushed engines, and a per-voice noise source. */
  held = 0
  heldFor = 0
  noise: number
  /** A little analog drift per voice, so chords breathe. */
  readonly drift: number

  constructor(fs: number, rng: Rng) {
    this.env = new EnvCore(fs, 1)
    this.drift = (rng.next() - 0.5) * 0.004
    this.noise = (rng.next() * 0x7fffffff) | 1
    for (let i = 0; i <= SAWS; i++) this.ph[i] = rng.next()
  }

  get sounding(): boolean {
    return this.gate > 0 || this.env.stage !== 0
  }

  /** White noise, −1..1 (xorshift: cheap and allocation-free). */
  white(): number {
    let x = this.noise
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.noise = x
    return (x | 0) / 0x80000000
  }

  /** Strike: (PLUCK) fill the string with a burst shaped by BRIGHT and PLUCK
   *  position; every engine restarts its brightness clock. */
  start(volts: number, vel: number, hold: number, born: number, k: Float64Array, fs: number): void {
    this.volts = volts
    this.vel = vel
    this.hold = hold
    this.gate = 10
    this.age = 0
    this.born = born
    const f = C4 * Math.pow(2, volts)
    const n = Math.min(KS_MAX - 1, Math.max(2, Math.round(fs / f)))
    let lp = 0
    const bright = 0.15 + k[1] * 0.85
    const pos = Math.max(1, Math.round(n * (0.05 + k[3] * 0.45)))
    for (let i = 0; i < n; i++) {
      lp += (this.white() - lp) * bright
      this.ks[i] = lp
    }
    // pluck position: a comb (the string can't move at its node)
    for (let i = n - 1; i >= pos; i--) this.ks[i] -= this.ks[i - pos] * 0.9
    this.ksPos = 0
  }
}
