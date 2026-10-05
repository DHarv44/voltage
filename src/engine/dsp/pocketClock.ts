import { Schmitt } from './cores'

/** The POCKET family's clock: 16ths from its own tempo with swing (odd steps
 *  land late), or one step per edge on CLK in. Also times the CLK out pulse
 *  and knows how long a step lasts (for gate lengths and arpeggios). */
export class PocketClock {
  step = -1
  /** Length of the current step (s): from the tempo, or measured between edges. */
  stepLen = 0.125
  private ph = 1
  private wasRunning = false
  private sinceEdge = 0
  private clkOut = 0
  private readonly clk = new Schmitt()

  constructor(
    private readonly steps: number,
    private readonly fs: number,
  ) {}

  /** Call once per sample; true when a new step starts (`step` is updated). */
  tick(running: boolean, patched: boolean, clkIn: number, tempo: number, swing: number): boolean {
    if (running && !this.wasRunning) {
      this.step = -1
      this.ph = 1
    }
    this.wasRunning = running
    if (!running) {
      this.step = -1
      return false
    }
    let advance = false
    if (patched) {
      this.sinceEdge += 1 / this.fs
      if (this.clk.rise(clkIn)) {
        if (this.sinceEdge < 2) this.stepLen = this.sinceEdge
        this.sinceEdge = 0
        advance = true
      }
    } else {
      const sixteenth = 60 / tempo / 4
      this.stepLen = sixteenth * (this.step % 2 === 0 ? 1 + swing : 1 - swing)
      this.ph += 1 / this.fs / this.stepLen
      if (this.ph >= 1) {
        this.ph -= 1
        advance = true
      }
    }
    if (advance) {
      this.step = (this.step + 1) % this.steps
      this.clkOut = Math.round(0.005 * this.fs)
    }
    return advance
  }

  /** The CLK out jack for this sample (a 5 ms pulse per step). */
  clkSample(): number {
    if (this.clkOut <= 0) return 0
    this.clkOut--
    return 10
  }
}
