import { SB_TAPE_S, SB_TRACKS } from '../../../modules/specs/sketchbook'

/** The motor eases tape speed changes over this long (s): a real transport swoops. */
const MOTOR_S = 0.18
const TAU = Math.PI * 2

/** The 4-track loop tape. Every track is the same loop of BARS bars (its
 *  length follows the tempo); the head plays the stretch between LOOP IN and
 *  LOOP OUT, at SPEED (varispeed: pitch and time together; negative runs it
 *  backwards), with a little WOW. Recording replaces the selected track under
 *  the head (punch in, punch out). LIFT cuts the loop stretch of a track to a
 *  clipboard, DROP pastes it at the head. The tape colours what comes back: a
 *  soft saturation (DRIVE) and a little high-end loss. Tracks that change are
 *  reported (`changed`) so the rack can keep them with the patch. */
export class Tape {
  readonly tracks: Float32Array[]
  /** The head (samples, fractional), the loop length, how much of each track holds audio. */
  pos = 0
  len = 1
  readonly ends = new Int32Array(SB_TRACKS)
  recording = false
  /** Tracks changed since the rack last saved them. */
  readonly changed = new Uint8Array(SB_TRACKS)
  /** Playback level per track, for the screen's meters. */
  readonly peak = new Float32Array(SB_TRACKS)
  private readonly lp = new Float32Array(SB_TRACKS)
  private readonly clip: Float32Array
  private clipLen = 0
  private speed = 1
  private wowPh = 0
  private wasRecording = false
  private readonly max: number
  private readonly motor: number

  constructor(private readonly fs: number) {
    this.max = Math.round(SB_TAPE_S * fs)
    this.tracks = Array.from({ length: SB_TRACKS }, () => new Float32Array(this.max))
    this.clip = new Float32Array(this.max)
    this.motor = 1 - Math.exp(-1 / (MOTOR_S * fs))
  }

  /** The loop length in samples for `bars` at a step length (s per 16th). */
  setLength(bars: number, stepLen: number): void {
    this.len = Math.max(1, Math.min(this.max, Math.round(bars * 16 * stepLen * this.fs)))
    if (this.pos >= this.len) this.pos %= this.len
  }

  /** The loop stretch [from, to) in samples (set by region()). */
  private from = 0
  private to = 1

  /** Work out the loop stretch from LOOP IN / OUT (0..1). */
  private region(tin: number, tout: number): void {
    const a = Math.min(tin, tout)
    const b = Math.max(tin, tout)
    this.from = Math.floor(a * this.len)
    this.to = Math.max(this.from + 1, Math.min(this.len, Math.ceil(b * this.len)))
  }

  /** Back to the start of the loop (the end, if it's running backwards). */
  rewind(tin: number, tout: number, speed: number): void {
    this.region(tin, tout)
    this.pos = speed < 0 ? this.to - 1 : this.from
    this.speed = speed
  }

  /** Erase a track. */
  clear(trk: number): void {
    this.tracks[trk]?.fill(0)
    this.ends[trk] = 0
    this.changed[trk] = 1
  }

  /** Cut the loop stretch of a track to the clipboard (leaving silence). */
  lift(trk: number, tin: number, tout: number): void {
    const t = this.tracks[trk]
    if (!t) return
    this.region(tin, tout)
    this.clipLen = this.to - this.from
    this.clip.set(t.subarray(this.from, this.to))
    t.fill(0, this.from, this.to)
    this.changed[trk] = 1
  }

  /** Paste the clipboard onto a track at the head (wrapping round the loop). */
  drop(trk: number): void {
    const t = this.tracks[trk]
    if (!t || !this.clipLen) return
    const at = Math.floor(this.pos)
    for (let i = 0; i < this.clipLen; i++) t[(at + i) % this.len] = this.clip[i]
    this.ends[trk] = Math.max(this.ends[trk], Math.min(this.len, at + this.clipLen))
    this.changed[trk] = 1
  }

  /** One sample: plays every track into `out`, records `input` onto `trk` if
   *  recording, and moves the head (only while running). */
  step(input: number, running: boolean, trk: number, drive: number, speed: number, tin: number, tout: number, wow: number, out: Float32Array): void {
    const sat = 1 + drive * 3
    const i0 = Math.floor(this.pos)
    const fr = this.pos - i0
    const i1 = (i0 + 1) % this.len
    for (let t = 0; t < SB_TRACKS; t++) {
      const tr = this.tracks[t]
      const raw = tr[i0] + (tr[i1] - tr[i0]) * fr
      this.lp[t] += (raw - this.lp[t]) * 0.6 // a little high-end loss
      const y = running && !(this.recording && t === trk) ? Math.tanh(this.lp[t] * sat) / sat : 0
      out[t] = y
      const a = Math.abs(y)
      this.peak[t] = a > this.peak[t] ? a : this.peak[t] * 0.99995 // meter falls back over ~½ s
    }
    // punching out: the track that was recorded needs saving
    if (this.wasRecording && !this.recording) this.changed[trk] = 1
    this.wasRecording = this.recording
    if (!running) return
    if (this.recording) {
      this.tracks[trk][i0] = input
      if (i0 >= this.ends[trk]) this.ends[trk] = i0 + 1
    }
    // the motor: speed eases toward SPEED, with a slow wow on top
    this.speed += (speed - this.speed) * this.motor
    this.wowPh = (this.wowPh + 0.55 / this.fs) % 1
    const v = this.speed * (1 + wow * 0.006 * Math.sin(TAU * this.wowPh))
    this.region(tin, tout)
    const from = this.from
    const to = this.to
    let p = this.pos + v
    const span = to - from
    if (p >= to) p = from + ((p - from) % span)
    else if (p < from) p = to - ((from - p) % span)
    this.pos = p
  }
}
