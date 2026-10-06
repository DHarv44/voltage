import { SB_TAPE_S, SB_TRACKS } from '../../../modules/specs/sketchbook'

/** The 4-track loop tape: every track is the same loop of BARS bars (its
 *  length follows the tempo), running while the transport plays. Recording
 *  replaces the selected track as the loop passes (punch in, punch out), and
 *  the tape colours what comes back: a soft tape saturation (DRIVE) and a
 *  touch of high-end loss each time it's played back. */
export class Tape {
  readonly tracks: Float32Array[]
  pos = 0
  len = 1
  recording = false
  /** Playback level per track, for the screen's meters. */
  readonly peak = new Float32Array(SB_TRACKS)
  private readonly lp = new Float32Array(SB_TRACKS)
  private readonly max: number

  constructor(fs: number) {
    this.max = Math.round(SB_TAPE_S * fs)
    this.tracks = Array.from({ length: SB_TRACKS }, () => new Float32Array(this.max))
  }

  /** The loop length in samples for `bars` at a step length (s per 16th). */
  setLength(bars: number, stepLen: number, fs: number): void {
    this.len = Math.max(1, Math.min(this.max, Math.round(bars * 16 * stepLen * fs)))
    if (this.pos >= this.len) this.pos %= this.len
  }

  rewind(): void {
    this.pos = 0
  }

  /** Erase a track. */
  clear(trk: number): void {
    this.tracks[trk]?.fill(0)
  }

  /** One sample: plays every track into `out`, records `input` onto `trk` if
   *  recording, and moves the tape on (only while running). */
  step(input: number, running: boolean, trk: number, drive: number, out: Float32Array): void {
    const pos = this.pos
    const sat = 1 + drive * 3
    for (let t = 0; t < SB_TRACKS; t++) {
      const raw = this.tracks[t][pos]
      this.lp[t] += (raw - this.lp[t]) * 0.6 // a little high-end loss
      const y = running && !(this.recording && t === trk) ? Math.tanh(this.lp[t] * sat) / sat : 0
      out[t] = y
      const a = Math.abs(y)
      this.peak[t] = a > this.peak[t] ? a : this.peak[t] * 0.99995 // meter falls back over ~½ s
    }
    if (!running) return
    if (this.recording) this.tracks[trk][pos] = input
    this.pos = (pos + 1) % this.len
  }
}
