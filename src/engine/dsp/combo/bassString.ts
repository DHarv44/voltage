import { Biquad } from '../biquad'
import { Mode } from '../modal'

/** The longest string period it holds (samples): E1 at 96 kHz fits. */
const MAX = 4096

export interface StringSpec {
  /** How long a held note rings (s), and how fast its top dies (loop
   *  filter 0 bright … 0.9 dull). */
  ring: number
  dull: number
  /** Where it's plucked (fraction of the string from the bridge) and how
   *  sharp the pluck is (0 a fingertip's round push … 1 a pick's snap). */
  at: number
  snap: number
  /** The pickup: where it sits (0 = none: a double bass, heard acoustically). */
  pickup: number
  /** The amp's tone (Hz), drive, and gain (makes up what the pickup and the
   *  string's damping take away, so every bass sits at the same level). */
  tone: number
  drive: number
  gain: number
  /** A double bass's wooden body (its two lowest resonances, Hz). */
  body?: [number, number]
}

/** A plucked string (a digital waveguide: one period of the string in a
 *  delay line, a loss filter in the loop). The pluck shapes the first
 *  period: a triangle peaked where the finger or pick pulled, smoothed for a
 *  fingertip, sharp for a pick. A magnetic pickup hears the string at one
 *  point (the comb that gives an electric bass its growl); a hand lifting
 *  off the string damps it. */
export class PluckedString {
  private readonly buf = new Float32Array(MAX)
  private at = 0
  private len = 100
  private gain = 0.99
  private dull = 0.3
  private lp = 0
  private spec: StringSpec | null = null
  private readonly tone: Biquad
  private readonly body = [new Mode(), new Mode()]
  private readonly bodyBp: Biquad
  private live = false
  private quiet = 0

  constructor(private readonly fs: number) {
    this.tone = new Biquad(fs)
    this.bodyBp = new Biquad(fs).bandpass(1000, 0.7)
  }

  pluck(s: StringSpec, f: number, vel: number, noise: () => number): void {
    if (this.spec !== s) {
      this.tone.lowpass(s.tone, 0.8)
      if (s.body) {
        this.body[0].tune(s.body[0], 0.08, this.fs)
        this.body[1].tune(s.body[1], 0.05, this.fs)
      }
      this.spec = s
    }
    // the period, less the loop filter's own delay
    this.dull = s.dull * (1.15 - 0.3 * vel)
    const n = Math.max(4, Math.min(MAX - 2, this.fs / f - this.dull / (1 - this.dull)))
    this.len = n
    this.gain = Math.pow(10, -3 / (s.ring * f))
    // the new pluck: a triangle peaked at the plucking point, rounded off by
    // the fingertip, over what the string was still doing (a fretted change)
    const N = Math.floor(n)
    const peak = Math.max(1, Math.floor(N * s.at))
    let smooth = 0
    const k = 0.15 + 0.8 * s.snap * (0.5 + 0.5 * vel)
    for (let i = 0; i < N; i++) {
      const tri = i < peak ? i / peak : (N - i) / (N - peak)
      smooth += (tri + noise() * 0.15 * s.snap - smooth) * k
      const j = (this.at - N + i + MAX * 2) % MAX
      this.buf[j] = this.buf[j] * 0.2 + (smooth - 0.5) * vel
    }
    this.live = true
    this.quiet = 0
  }

  /** The hand comes off: the string is damped within a few periods. */
  damp(f: number): void {
    this.gain = Math.min(this.gain, Math.pow(10, -3 / (0.07 * f)))
  }

  private read(back: number): number {
    const p = this.at - back
    const i = Math.floor(p)
    const fr = p - i
    const a = this.buf[(i + MAX * 2) % MAX]
    const b = this.buf[(i + 1 + MAX * 2) % MAX]
    return a + (b - a) * fr
  }

  step(): number {
    if (!this.live) return 0
    const s = this.spec!
    // round the loop: the period's sample comes back, a little duller and quieter
    const x = this.read(this.len)
    this.lp = x * (1 - this.dull) + this.lp * this.dull
    const y = this.lp * this.gain
    this.buf[this.at] = y
    this.at = (this.at + 1) % MAX
    // where we hear it from
    let out = s.pickup > 0 ? y - this.read(this.len * s.pickup) : y
    if (s.body) {
      const b = this.bodyBp.run(out)
      this.body[0].drive(b * 0.02)
      this.body[1].drive(b * 0.015)
      out += this.body[0].step() + this.body[1].step()
    }
    out = this.tone.run(out)
    // silent for a whole period: the string has stopped
    this.quiet = Math.abs(y) < 1e-6 ? this.quiet + 1 : 0
    if (this.quiet > this.len) this.live = false
    return Math.tanh(out * s.gain * s.drive) / s.drive
  }
}
