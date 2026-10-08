import { DelayLine } from './delayLine'

/** Delay-line pitch shifter (the classic harmoniser): two taps sweep through
 *  a short window at the speed that bends the pitch by `ratio`, half a
 *  window apart, each faded in and out (sin²/cos², so they always sum to
 *  one) to hide the jump when a tap wraps. A longer window is smoother but
 *  smears transients; a short one is tighter and more "glitchy". */
export class PitchShifter {
  private readonly line: DelayLine
  private ph = 0

  constructor(
    private readonly fs: number,
    private readonly maxWindowS = 0.2,
  ) {
    this.line = new DelayLine(maxWindowS * fs + 8)
  }

  /** One sample in, one out. `windowS` is clamped to the line's length. */
  process(x: number, ratio: number, windowS = 0.06): number {
    this.line.write(x)
    const w = Math.max(64, Math.min(this.maxWindowS, windowS) * this.fs)
    // the taps' delay shrinks (pitch up) or grows (pitch down) by 1 − ratio per sample
    this.ph += (1 - ratio) / w
    this.ph -= Math.floor(this.ph)
    const p2 = this.ph + 0.5 >= 1 ? this.ph - 0.5 : this.ph + 0.5
    const s1 = Math.sin(Math.PI * this.ph)
    const s2 = Math.sin(Math.PI * p2)
    return this.line.tapLin(2 + this.ph * w) * s1 * s1 + this.line.tapLin(2 + p2 * w) * s2 * s2
  }
}
