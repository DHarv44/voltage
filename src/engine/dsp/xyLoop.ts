/** Frames per second the gesture is recorded at (smooth enough for any hand). */
export const LOOP_RATE = 250
const MAX_SECONDS = 60
const FRAME = 4 // x, y, pressure, gate

/** Records a hand gesture and loops it. When a clock is patched the loop is
 *  rounded to a whole number of clock pulses and restarts on the clock, so it
 *  stays locked to the music however long you play. */
export class GestureLoop {
  private readonly buf = new Float32Array(LOOP_RATE * MAX_SECONDS * FRAME)
  /** Frames in the finished loop (0 = empty). */
  len = 0
  private rec = 0
  /** 0 idle, 1 armed (waiting for the first touch), 2 recording. */
  state = 0
  playing = false
  private pos = 0
  // clock sync
  private pulses = 0
  private sinceEdge = 0
  private period = 0
  private loopPulses = 0
  private edgeCount = 0

  arm(): void {
    if (this.state === 2) return this.stop()
    this.state = 1
    this.playing = false
  }

  /** Called with each recorded frame time step; starts recording on touch. */
  record(x: number, y: number, p: number, gate: boolean): void {
    if (this.state === 1 && gate) {
      this.state = 2
      this.rec = 0
      this.pulses = 0
    }
    if (this.state !== 2) return
    if (this.rec >= this.buf.length / FRAME) return this.stop()
    const k = this.rec++ * FRAME
    this.buf[k] = x
    this.buf[k + 1] = y
    this.buf[k + 2] = p
    this.buf[k + 3] = gate ? 1 : 0
  }

  stop(): void {
    if (this.state !== 2 || this.rec < 2) {
      this.state = 0
      return
    }
    this.state = 0
    this.len = this.rec
    this.pos = 0
    this.playing = true
    // Snap to the clock: a whole number of pulses, at least one.
    if (this.period > 0) {
      const secs = this.len / LOOP_RATE
      this.loopPulses = Math.max(1, Math.round(secs / this.period))
      this.edgeCount = 0
    } else this.loopPulses = 0
  }

  toggle(): void {
    if (this.len) this.playing = !this.playing
    this.pos = 0
    this.edgeCount = 0
  }

  /** Advance time by dt seconds; `edge` = a clock pulse arrived. */
  clock(dt: number, edge: boolean, clocked: boolean): void {
    this.sinceEdge += dt
    if (edge) {
      if (this.sinceEdge < 4) this.period = this.period ? this.period * 0.7 + this.sinceEdge * 0.3 : this.sinceEdge
      this.sinceEdge = 0
      this.pulses++
    }
    if (!clocked) this.period = 0
    if (!this.playing || !this.len) return
    this.pos += dt * LOOP_RATE
    if (this.loopPulses && edge && ++this.edgeCount >= this.loopPulses) {
      this.edgeCount = 0
      this.pos = 0
    }
    if (this.pos >= this.len) this.pos = this.loopPulses ? this.len - 1 : this.pos - this.len
  }

  /** Read the loop at the play head into out[0..3]. */
  read(out: Float64Array): void {
    const i = Math.min(this.len - 1, Math.floor(this.pos))
    const j = Math.min(this.len - 1, i + 1)
    const f = this.pos - Math.floor(this.pos)
    for (let c = 0; c < 3; c++) out[c] = this.buf[i * FRAME + c] * (1 - f) + this.buf[j * FRAME + c] * f
    out[3] = this.buf[i * FRAME + 3]
  }

  progress(): number {
    return this.len ? this.pos / this.len : 0
  }
}
