import { COMBO_PARTS } from '../../../modules/specs/combo/params'

export const L_NONE = 0
export const L_REC = 1
export const L_PLAY = 2
export const L_DUB = 3
export const L_STOP = 4

/** Longest loop (s). */
const MAX_S = 90
/** STRETCH's grains (s): two of them, half a grain apart, Hann-windowed. */
const GRAIN_S = 0.06

/** A loop for each song part, locked to the band. With the band playing a
 *  loop is exactly one pass of its part: recording starts where the band is
 *  and stops when it comes round again; playback reads at the band's place
 *  in the part, so it stays in time whatever happens. When the tempo isn't
 *  the one it was recorded at, TAPE reads faster or slower (the pitch moves
 *  with it, like varispeed) and STRETCH keeps the pitch (two overlapping
 *  grains, each restarted at the band's place). With no band (a part not
 *  learned) it's a free looper: press to record, press to close. */
export class PartLooper {
  readonly state = new Uint8Array(COMBO_PARTS)
  readonly len = new Int32Array(COMBO_PARTS)
  /** The tempo each loop was recorded at (0: a free loop). */
  readonly bpm = new Float64Array(COMBO_PARTS)
  private readonly bufs: (Float32Array | null)[] = Array(COMBO_PARTS).fill(null)
  private readonly done = new Int32Array(COMBO_PARTS)
  private readonly free = new Int32Array(COMBO_PARTS)
  private undoBuf: Float32Array | null = null
  private undoPart = -1
  private readonly max: number
  private readonly grain: number
  private ga = 0
  private gb = 0
  private pa = 0
  private pb = 0
  private grainOn = false

  /** WSOLA: how far either side of the band's place a grain may start
   *  (covers the period of notes down to ~100 Hz), and how much it compares. */
  private readonly search: number
  private readonly match: number

  constructor(private readonly fs: number) {
    this.max = Math.round(MAX_S * fs)
    this.grain = Math.round(GRAIN_S * fs)
    this.search = Math.round(0.01 * fs)
    this.match = Math.round(0.006 * fs)
  }

  /** The LOOPER switch on part p. `samples` is the part's length now (0
   *  with no band), `bpm` its tempo. Returns true when a loop just closed. */
  press(p: number, samples: number, bpm: number): boolean {
    const s = this.state[p]
    if (s === L_NONE) {
      const n = samples > 0 ? Math.min(this.max, samples) : this.max
      if (!this.bufs[p] || this.bufs[p]!.length < n) this.bufs[p] = new Float32Array(n) // once per part
      this.bufs[p]!.fill(0, 0, n)
      this.len[p] = samples > 0 ? n : 0
      this.bpm[p] = samples > 0 ? bpm : 0
      this.done[p] = 0
      this.state[p] = L_REC
    } else if (s === L_REC) {
      if (!this.len[p]) this.len[p] = Math.max(1, this.done[p]) // a free loop closes here
      this.state[p] = L_PLAY
      return true
    } else if (s === L_PLAY) {
      // keep a copy to undo this overdub
      if (!this.undoBuf || this.undoBuf.length < this.len[p]) this.undoBuf = new Float32Array(Math.max(this.len[p], this.undoBuf?.length ?? 0))
      this.undoBuf.set(this.bufs[p]!.subarray(0, this.len[p]))
      this.undoPart = p
      this.state[p] = L_DUB
    } else if (s === L_DUB) {
      this.state[p] = L_PLAY
      return true
    } else if (s === L_STOP) this.state[p] = L_PLAY
    return false
  }

  /** Take back the last overdub on part p. */
  undo(p: number): boolean {
    if (this.undoPart !== p || !this.undoBuf || !this.bufs[p]) return false
    this.bufs[p]!.set(this.undoBuf.subarray(0, this.len[p]))
    this.undoPart = -1
    if (this.state[p] === L_DUB) this.state[p] = L_PLAY
    return true
  }

  clear(p: number): void {
    this.state[p] = L_NONE
    this.len[p] = 0
    this.bpm[p] = 0
    if (this.undoPart === p) this.undoPart = -1
  }

  /** A loop restored with the rack. */
  load(p: number, data: Float32Array, bpm: number): void {
    if (!data.length) return this.clear(p)
    this.bufs[p] = data
    this.len[p] = data.length
    this.bpm[p] = bpm
    this.state[p] = L_STOP
  }

  data(p: number): Float32Array | null {
    return this.len[p] ? this.bufs[p]!.subarray(0, this.len[p]) : null
  }

  /** One sample on part p. `phase` 0..1 through the part (−1: no band),
   *  `bpm` the band's tempo now, `stretch` STRETCH (else TAPE). */
  step(p: number, x: number, phase: number, bpm: number, stretch: boolean): number {
    const s = this.state[p]
    const buf = this.bufs[p]
    if (s === L_NONE || !buf) return 0
    // a loop made with the band plays with the band, and rests when it stops
    if (phase < 0 && this.bpm[p] > 0) {
      if (s === L_REC || s === L_DUB) this.state[p] = L_PLAY
      return 0
    }
    const banded = phase >= 0 && this.bpm[p] > 0
    if (s === L_REC) {
      if (banded) {
        buf[Math.min(this.len[p] - 1, Math.floor(phase * this.len[p]))] = x
        if (++this.done[p] >= this.len[p]) this.state[p] = L_PLAY
      } else {
        if (this.done[p] < buf.length) buf[this.done[p]++] = x
        else this.press(p, 0, 0)
      }
      return 0
    }
    if (s === L_STOP) return 0
    const len = this.len[p]
    let at: number
    if (banded) at = phase * len
    else {
      this.free[p] = (this.free[p] + 1) % len
      at = this.free[p]
    }
    const i = Math.min(len - 1, Math.floor(at))
    if (s === L_DUB) buf[i] += x
    // the seam: a few ms of fade so the loop's ends never click
    const edge = Math.min(1, at / 200, (len - at) / 200)
    if (!banded || !stretch || Math.abs(bpm / this.bpm[p] - 1) < 0.01) {
      this.grainOn = false
      const f = at - i
      return (buf[i] * (1 - f) + buf[(i + 1) % len] * f) * edge
    }
    return this.grains(buf, len, at) * edge
  }

  /** STRETCH: two grains half a grain apart, each read at the recorded speed
   *  and restarted at the band's place, so the pitch never moves. */
  private grains(buf: Float32Array, len: number, at: number): number {
    const G = this.grain
    if (!this.grainOn) {
      this.grainOn = true
      this.ga = 0
      this.gb = G / 2
      this.pa = at
      this.pb = at - G / 2
    }
    const wa = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.ga) / G)
    const wb = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.gb) / G)
    const ia = ((Math.floor(this.pa) % len) + len) % len
    const ib = ((Math.floor(this.pb) % len) + len) % len
    const y = buf[ia] * wa + buf[ib] * wb
    this.pa++
    this.pb++
    // each grain restarts near the band's place, at the point where the
    // waveform lines up with the grain still sounding (WSOLA), so the two
    // overlap in phase instead of smearing
    if (++this.ga >= G) {
      this.ga = 0
      this.pa = this.aligned(buf, len, at, this.pb)
    }
    if (++this.gb >= G) {
      this.gb = 0
      this.pb = this.aligned(buf, len, at, this.pa)
    }
    return y
  }

  /** The start near `at` whose next few ms best match what's playing from `ref`. */
  private aligned(buf: Float32Array, len: number, at: number, ref: number): number {
    const S = this.search
    const N = this.match
    const r0 = Math.floor(ref)
    let best = at
    let bestScore = -Infinity
    for (let k = -S; k <= S; k += 2) {
      const p0 = Math.floor(at) + k
      let s = 0
      for (let j = 0; j < N; j += 2) s += buf[(((p0 + j) % len) + len) % len] * buf[(((r0 + j) % len) + len) % len]
      if (s > bestScore) {
        bestScore = s
        best = p0
      }
    }
    return best
  }
}
