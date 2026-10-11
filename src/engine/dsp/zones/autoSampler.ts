import { ZN_MAX_S } from '../../../modules/specs/zones'
import type { ZoneMap } from '../sampling/multi'

/** Gate low between takes (so the voice's envelope starts again, and its CV settles first). */
const GAP_S = 0.04
/** Each take's last moments faded (a tail cut short doesn't click). */
const FADE_S = 0.004

/** AUTO: plays a voice in the rack note by note through CV, GATE and VEL and
 *  records each take from IN into one buffer, laid out as a ZoneMap. */
export class AutoSampler {
  active = false
  readonly map: ZoneMap = { lo: 36, every: 6, roots: 1, layers: 1, rr: 1, slot: 1 }
  buf: Float32Array = new Float32Array(0)
  take = -1
  /** What it's playing the voice: V/OCT (volts), gate (volts), velocity (volts). */
  cv = 0
  gate = 0
  vel = 0
  private takes = 0
  private pos = 0
  private holdN = 0
  private readonly gapN: number
  private readonly fadeN: number

  constructor(private readonly fs: number) {
    this.gapN = Math.round(GAP_S * fs)
    this.fadeN = Math.round(FADE_S * fs)
  }

  /** Begin (allocates the buffer: call from a UI event, not the audio tick).
   *  False when the takes would run past ZN_MAX_S. */
  start(lo: number, hi: number, every: number, layers: number, rr: number, hold: number, tail: number): boolean {
    const m = this.map
    m.lo = lo
    m.every = every
    m.roots = Math.max(1, Math.floor((Math.max(lo, hi) - lo) / every) + 1)
    m.layers = layers
    m.rr = rr
    m.slot = Math.max(1, Math.round((hold + tail) * this.fs))
    this.takes = m.layers * m.rr * m.roots
    if (this.takes * m.slot > ZN_MAX_S * this.fs) return false
    this.buf = new Float32Array(this.takes * m.slot)
    this.holdN = Math.round(hold * this.fs)
    this.take = 0
    this.pos = -this.gapN
    this.active = true
    return true
  }

  stop(): void {
    this.active = false
    this.take = -1
    this.gate = 0
  }

  get progress(): number {
    return this.active ? (this.take * this.map.slot + Math.max(0, this.pos)) / (this.takes * this.map.slot) : 0
  }

  /** One sample of IN (volts). True on the sample the last take finishes. */
  run(x: number): boolean {
    if (!this.active) return false
    const m = this.map
    const r = this.take % m.roots
    const layer = Math.floor(this.take / (m.rr * m.roots))
    this.cv = (m.lo + r * m.every - 60) / 12
    this.vel = ((layer + 1) / m.layers) * 10
    if (this.pos < 0) {
      this.gate = 0
      this.pos++
      return false
    }
    this.gate = this.pos < this.holdN ? 10 : 0
    const at = this.take * m.slot
    this.buf[at + this.pos] = x / 5
    if (++this.pos < m.slot) return false
    const f = Math.min(this.fadeN, m.slot)
    for (let i = 0; i < f; i++) this.buf[at + m.slot - 1 - i] *= i / f
    this.pos = -this.gapN
    if (++this.take < this.takes) return false
    this.stop()
    return true
  }
}
