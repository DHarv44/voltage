/** A metronome sound: two struck sine modes (the second at `ratio` × the
 *  first) and a snap of noise, each dying away on its own time (seconds). */
export interface ClickSound {
  f: number
  ratio: number
  t1: number
  t2: number
  a2: number
  noise: number
  tn: number
}

/** In the order of METRONOME's SOUND options (CLICK_NAMES in its spec). */
export const CLICK_SOUNDS: ClickSound[] = [
  // a quartz metronome's tick
  { f: 2000, ratio: 2.7, t1: 0.012, t2: 0.006, a2: 0.4, noise: 0.5, tn: 0.003 },
  // a woodblock: two hollow modes
  { f: 900, ratio: 2.4, t1: 0.045, t2: 0.02, a2: 0.5, noise: 0.2, tn: 0.002 },
  // claves: one bright ringing mode
  { f: 2500, ratio: 3.1, t1: 0.035, t2: 0.01, a2: 0.15, noise: 0.1, tn: 0.001 },
  // a digital beep, octave on top
  { f: 1000, ratio: 2, t1: 0.06, t2: 0.04, a2: 0.15, noise: 0, tn: 0.001 },
]
/** The clockwork escapement of a wind-up metronome, and its bell. */
export const CLACK: ClickSound = { f: 1500, ratio: 3.3, t1: 0.02, t2: 0.008, a2: 0.6, noise: 0.7, tn: 0.004 }
export const BELL: ClickSound = { f: 2100, ratio: 2.76, t1: 0.9, t2: 0.4, a2: 0.5, noise: 0.05, tn: 0.002 }

const TAU = Math.PI * 2

/** One struck click (a new strike cuts the last). No allocation. */
export class ClickVoice {
  private ph1 = 0
  private ph2 = 0
  private d1 = 0
  private d2 = 0
  private e1 = 0
  private e2 = 0
  private en = 0
  private k1 = 0
  private k2 = 0
  private kn = 0
  private seed = 0x2545f491

  constructor(private readonly fs: number) {}

  /** Strike `s` at `gain`, its pitch scaled by `pitch`. */
  strike(s: ClickSound, gain: number, pitch = 1): void {
    const fs = this.fs
    this.d1 = (s.f * pitch) / fs
    this.d2 = (s.f * s.ratio * pitch) / fs
    this.ph1 = 0
    this.ph2 = 0
    this.e1 = gain
    this.e2 = gain * s.a2
    this.en = gain * s.noise
    this.k1 = Math.exp(-1 / (s.t1 * fs))
    this.k2 = Math.exp(-1 / (s.t2 * fs))
    this.kn = Math.exp(-1 / (s.tn * fs))
  }

  /** The next sample (about ±1 at gain 1). */
  next(): number {
    if (this.e1 + this.e2 + this.en < 1e-5) return 0
    this.ph1 += this.d1
    if (this.ph1 >= 1) this.ph1 -= 1
    this.ph2 += this.d2
    if (this.ph2 >= 1) this.ph2 -= 1
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0
    const n = this.seed / 2147483648 - 1
    const y = this.e1 * Math.sin(TAU * this.ph1) + this.e2 * Math.sin(TAU * this.ph2) + this.en * n
    this.e1 *= this.k1
    this.e2 *= this.k2
    this.en *= this.kn
    return y
  }
}
