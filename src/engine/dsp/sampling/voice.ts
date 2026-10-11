/** A sample in memory: its data and the rate it was made at. */
export interface SampleData {
  data: Float32Array
  len: number
  rate: number
}

export const LOOP_OFF = 0
export const LOOP_FWD = 1
export const LOOP_PING = 2

/** One voice playing a region of a sample. INTERP plays it smoothly at any
 *  pitch (a modern sampler). VARIABLE runs the voice's own converter clock at
 *  the sample's rate × the pitch and holds each sample until the next tick:
 *  how the period hardware played, the aliasing following the note. A short
 *  attack and a release envelope; loops forward or back and forth. */
export class SampleVoice {
  sample: SampleData | null = null
  /** Region (source samples) and loop points within it. */
  start = 0
  end = 0
  loopStart = 0
  loopEnd = 0
  loop = LOOP_OFF
  /** Playback speed (1 = original pitch), and the variable-rate mode. */
  ratio = 1
  variable = false
  reverse = false
  level = 1
  attack = 0.002
  release = 0.05
  active = false
  /** Samples played since the start (for retriggers and display). */
  age = 0
  private pos = 0
  private dir = 1
  private env = 0
  private gate = false
  private held = 0
  private ph = 1

  constructor(private readonly fs: number) {}

  /** Start the region from the top (or the end, reversed). */
  trigger(s: SampleData, start: number, end: number, ratio: number, level: number): void {
    this.sample = s
    this.start = Math.max(0, Math.min(s.len - 1, Math.floor(start)))
    this.end = Math.max(this.start + 1, Math.min(s.len, Math.floor(end)))
    if (this.loopEnd <= this.loopStart || this.loopEnd > this.end) {
      this.loopStart = this.start
      this.loopEnd = this.end
    }
    this.ratio = ratio
    this.level = level
    this.pos = this.reverse ? this.end - 1 : this.start
    this.dir = this.reverse ? -1 : 1
    this.env = 0
    this.gate = true
    this.active = true
    this.age = 0
    this.ph = 1
  }

  /** Let go: the release envelope runs out (a looping voice stops looping in it). */
  noteOff(): void {
    this.gate = false
  }

  /** Stop now (choke). */
  kill(): void {
    this.active = false
    this.env = 0
  }

  private read(at: number): number {
    const d = this.sample!.data
    const i = Math.floor(at)
    const f = at - i
    const a = d[i] ?? 0
    const b = d[Math.min(i + 1, this.end - 1)] ?? 0
    return a + (b - a) * f
  }

  step(): number {
    if (!this.active || !this.sample) return 0
    const s = this.sample
    const inc = (s.rate / this.fs) * this.ratio
    let y: number
    if (this.variable) {
      // the voice's DAC clock: a new source sample each tick, held between
      this.ph += inc
      if (this.ph >= 1) {
        const n = Math.floor(this.ph)
        this.ph -= n
        this.advance(n)
        this.held = s.data[Math.floor(this.pos)] ?? 0
      }
      y = this.held
    } else {
      y = this.read(this.pos)
      this.advance(inc)
    }
    // envelope: a quick attack, a release once the gate falls
    if (this.gate) this.env = Math.min(1, this.env + 1 / Math.max(1, this.attack * this.fs))
    else {
      this.env -= 1 / Math.max(1, this.release * this.fs)
      if (this.env <= 0) this.active = false
    }
    this.age++
    return y * this.env * this.level
  }

  /** Move the play position by d source samples, honouring the loop. */
  private advance(d: number): void {
    this.pos += d * this.dir
    if (this.loop !== LOOP_OFF && this.gate) {
      if (this.dir > 0 && this.pos >= this.loopEnd) {
        if (this.loop === LOOP_PING) {
          this.dir = -1
          this.pos = this.loopEnd - (this.pos - this.loopEnd) - 1
        } else this.pos = this.loopStart + (this.pos - this.loopEnd)
      } else if (this.dir < 0 && this.pos < this.loopStart) {
        if (this.loop === LOOP_PING) {
          this.dir = 1
          this.pos = this.loopStart + (this.loopStart - this.pos)
        } else this.pos = this.loopEnd - (this.loopStart - this.pos)
      }
    }
    if (this.pos >= this.end || this.pos < this.start) this.active = false
  }
}
