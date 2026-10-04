/** Clocked step engine shared by TR-16 and GROOVE-1.
 *  Each clock edge is one step. Swing delays every second step by a fraction
 *  of the measured clock period (so it follows tempo changes). Live hits are
 *  quantised to the nearest step. */
export class StepSeqCore {
  step = -1
  /** Samples between the last two clock edges. */
  private period: number
  private since = 0
  private pending = -1
  private readonly fs: number

  constructor(fs: number) {
    this.fs = fs
    this.period = fs * 0.125
  }

  reset(): void {
    this.step = -1
    this.pending = -1
  }

  /** Advance one sample. Returns the step that fires on this sample, or −1. */
  tick(clockEdge: boolean, length: number, swing: number): number {
    this.since++
    let fire = -1
    if (this.pending > 0 && --this.pending === 0) {
      fire = this.step
      this.pending = -1
    }
    if (clockEdge) {
      if (this.since > 8 && this.since < this.fs * 4) this.period = this.since
      this.since = 0
      this.step = (this.step + 1) % Math.max(1, length)
      const delay = this.step % 2 === 1 ? Math.round(Math.min(swing, 0.9) * 0.5 * this.period) : 0
      if (delay > 0) this.pending = delay
      else fire = this.step
    }
    return fire
  }

  /** Step a live hit belongs to: the current one if we're early in it, else the next. */
  nearestStep(length: number): number {
    if (this.step < 0) return 0
    return this.since < this.period / 2 ? this.step : (this.step + 1) % Math.max(1, length)
  }
}

export const hasStep = (mask: number, step: number) => ((mask >>> step) & 1) === 1

/** Internal tempo clock: 16th-note edges at `bpm`. */
export class TempoClock {
  private phase = 0
  constructor(private readonly fs: number) {}
  reset(): void {
    this.phase = 0
  }
  /** True on the sample a 16th note starts. */
  tick(bpm: number): boolean {
    const was = this.phase
    this.phase += (bpm * 4) / 60 / this.fs
    if (this.phase >= 1) this.phase -= 1
    return was === 0 || this.phase < was
  }
  /** High for the first half of each 16th (a usable gate/clock output). */
  get high(): boolean {
    return this.phase < 0.5
  }
}
