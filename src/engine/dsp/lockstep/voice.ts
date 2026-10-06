import { LS_RATIOS, ratioIndex } from '../../../modules/specs/lockstepDefs'
import { Svf } from '../drumVoices'
import { C4, TAU } from '../util'

/** −60 dB at the knob time. */
const T60 = 6.9
const SWEEP_S = 0.04

/** One LOCKSTEP track's voice: three sine operators C (carrier), A and B
 *  (B can feed back on itself) in one of six algorithms, a modulation
 *  envelope on the FM depth, a pitch sweep, an AD amp envelope and a
 *  filter. Knob values arrive normalised (0..1) and are mapped here:
 *  RATIO DEPTH FEEDBK MOD-DEC · ATTACK DECAY SWEEP LEVEL · CUTOFF RESO (PAN, DELAY: the mixer's). */
export class FmVoice {
  private pc = 0
  private pa = 0
  private pb = 0
  private a1 = 0
  private b1 = 0
  private mod = 0
  private sweep = 0
  private rising = false
  private readonly svf = new Svf()
  private readonly sweepK: number
  amp = 0
  volts = 0
  out = 0
  /** The playing note's locked knobs (−1 = follows the knob). */
  readonly locks = new Float64Array(12).fill(-1)

  constructor(private readonly fs: number) {
    this.sweepK = Math.exp(-1 / (SWEEP_S * fs))
  }

  start(volts: number): void {
    this.volts = volts
    this.rising = true
    this.mod = 1
    this.sweep = 1
  }

  /** One sample with the knobs `v` (locks already applied). */
  step(v: Float64Array, algo: number): void {
    const fs = this.fs
    if (!this.rising && this.amp < 1e-5) {
      this.amp = 0
      this.out = 0
      return
    }
    if (this.rising) {
      this.amp += 1 / ((0.0005 + v[4] * v[4] * 2) * fs)
      if (this.amp >= 1) {
        this.amp = 1
        this.rising = false
      }
    } else this.amp *= Math.exp(-T60 / (0.02 * Math.pow(200, v[5]) * fs))
    this.mod *= Math.exp(-T60 / (0.01 * Math.pow(300, v[3]) * fs))
    this.sweep *= this.sweepK

    const r = LS_RATIOS[ratioIndex(v[0])]
    const f = C4 * Math.pow(2, this.volts + v[6] * 5 * this.sweep)
    const dt = f / fs
    const I = v[1] * v[1] * 8 * this.mod
    const fb = v[2] * 1.4 * this.b1

    const tc = TAU * this.pc
    const ta = TAU * this.pa
    const tb = TAU * this.pb
    let x: number
    let a: number
    let b: number
    switch (algo) {
      case 0: // (A + B) → C
        a = Math.sin(ta)
        b = Math.sin(tb + fb)
        x = Math.sin(tc + I * (a + b))
        break
      case 2: // A → C, B heard too
        a = Math.sin(ta)
        b = Math.sin(tb + fb)
        x = 0.65 * Math.sin(tc + I * a) + 0.45 * b
        break
      case 3: // A → C and A → B, both heard
        a = Math.sin(ta + v[2] * 1.4 * this.a1)
        b = Math.sin(tb + I * a)
        x = 0.55 * (Math.sin(tc + I * a) + b)
        break
      case 4: // all three heard, DEPTH sets A and B's level
        a = Math.sin(ta)
        b = Math.sin(tb + fb)
        x = 0.6 * Math.sin(tc) + v[1] * (0.45 * a + 0.35 * b)
        break
      case 5: // B → A and B → C, A → C
        b = Math.sin(tb + fb)
        a = Math.sin(ta + I * b)
        x = Math.sin(tc + I * (a + 0.5 * b))
        break
      default: // 1: B → A → C
        b = Math.sin(tb + fb)
        a = Math.sin(ta + I * b)
        x = Math.sin(tc + I * a)
    }
    this.a1 = a
    this.b1 = b
    this.pc = (this.pc + dt * r[0]) % 1
    this.pa = (this.pa + dt * r[1]) % 1
    this.pb = (this.pb + dt * r[2]) % 1

    this.svf.process(x, 40 * Math.pow(450, v[8]), 2 - 1.85 * v[9], fs)
    this.out = this.svf.lp * this.amp * v[7]
  }
}
