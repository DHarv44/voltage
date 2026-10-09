import { DelayLine } from './delayLine'

/** A plucked or driven string (Karplus-Strong): a delay line one period long
 *  with a one-pole low-pass in the loop (brighter strings ring with more
 *  overtones) and a loss per trip round it (how long it rings). It can be
 *  plucked (a noise burst shaped by where it's plucked) or driven by any
 *  audio, so it also rings in sympathy. Shared by KALEIDO and RESONATOR. */
export class KsString {
  private readonly line: DelayLine
  private readonly burst: Float32Array
  private burstAt = 0
  private burstLen = 0
  private lp = 0
  private period = 100
  private loss = 0.99
  private a = 0.5
  private seed: number
  /** Roughly how much is still ringing (skip it when it's silent). */
  live = 0

  constructor(maxPeriod: number, seed: number) {
    this.line = new DelayLine(maxPeriod + 4)
    this.burst = new Float32Array(Math.ceil(maxPeriod) + 4)
    this.seed = seed | 1
  }

  /** Pitch (Hz), ring time (s, to −60 dB), brightness 0..1. */
  tune(f: number, fs: number, decay: number, bright: number): void {
    this.a = 0.08 + 0.9 * bright
    // the loop filter delays by about (1 − a) / a samples: take it off the line
    const max = this.burst.length - 4
    this.period = Math.max(2, Math.min(max, fs / Math.max(20, f) - (1 - this.a) / this.a))
    this.loss = Math.pow(0.001, this.period / (Math.max(0.02, decay) * fs))
  }

  /** Pluck: a burst one period long. `pos` 0..1 is where along the string (near
   *  the end: thin and bright; the middle: round, the even harmonics gone). */
  pluck(amp: number, bright: number, pos: number): void {
    const n = Math.max(2, Math.round(this.period))
    const b = this.burst
    let lp = 0
    for (let i = 0; i < n; i++) {
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
      lp += ((this.seed / 2147483648) - lp) * (0.15 + 0.85 * bright)
      b[i] = lp
    }
    // the pluck position: the string can't move where it's held still
    const off = Math.max(1, Math.round(n * Math.max(0.03, Math.min(0.5, pos))))
    for (let i = n - 1; i >= off; i--) b[i] -= b[i - off]
    let mean = 0
    for (let i = 0; i < n; i++) mean += b[i]
    mean /= n
    for (let i = 0; i < n; i++) b[i] = (b[i] - mean) * amp
    this.burstLen = n
    this.burstAt = 0
    this.live = 1
  }

  /** One sample; `drive` is audio pushed into the string. */
  step(drive = 0): number {
    let x = drive
    if (this.burstAt < this.burstLen) x += this.burst[this.burstAt++]
    const d = this.line.tapLin(this.period)
    this.lp += (d - this.lp) * this.a
    const y = this.lp * this.loss + x
    this.line.write(y)
    this.live = this.live * 0.9995 + Math.abs(y) * 0.0005
    return y
  }
}
