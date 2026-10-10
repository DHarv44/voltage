import { MAX_VOICES } from './base'

/** What the pool needs to know about a voice. */
export interface PoolVoice {
  live: boolean
  pitch: number
}

/** Keys → a pool of voices larger than the poly cable, as a piano's strings
 *  are: a note keeps its own voice for as long as it sounds (held, then held
 *  by the sustain pedal, then dying away), however many notes come after it on
 *  the same channel. A key struck again while its note still rings strikes
 *  the same voice (the same strings). */
export class PedalPool {
  /** Channel → the voice its key is holding down (−1 none). */
  readonly chan = new Int8Array(MAX_VOICES).fill(-1)
  /** Voices whose key is up but the pedal holds them. */
  readonly pedalHeld: Uint8Array
  private readonly keyHeld: Uint8Array
  private readonly stamp: Float64Array
  private clock = 0

  constructor(private readonly voices: PoolVoice[]) {
    const n = voices.length
    this.pedalHeld = new Uint8Array(n)
    this.keyHeld = new Uint8Array(n)
    this.stamp = new Float64Array(n)
  }

  /** A key goes down on channel c: the voice that plays it. Prefers the
   *  voice already ringing that pitch, then a silent one, then the one that
   *  has been dying longest, then the oldest pedal-held one; a held key's
   *  voice only as a last resort. */
  down(c: number, pitch: number): number {
    const v = this.voices
    let pick = -1
    for (let i = 0; i < v.length && pick < 0; i++) if (v[i].live && !this.keyHeld[i] && Math.abs(v[i].pitch - pitch) < 0.002) pick = i
    for (let i = 0; i < v.length && pick < 0; i++) if (!v[i].live && !this.keyHeld[i]) pick = i
    if (pick < 0) pick = this.oldest(0)
    if (pick < 0) pick = this.oldest(1)
    if (pick < 0) pick = this.oldest(2)
    // the voice this channel was holding (no gap between its notes): let it go
    const was = this.chan[c]
    if (was >= 0 && was !== pick) this.keyHeld[was] = 0
    for (let k = 0; k < MAX_VOICES; k++) if (this.chan[k] === pick) this.chan[k] = -1
    this.chan[c] = pick
    this.keyHeld[pick] = 1
    this.pedalHeld[pick] = 0
    this.stamp[pick] = ++this.clock
    return pick
  }

  /** The key on channel c comes up: the voice to damp now, or −1 when the
   *  pedal holds it (or nothing was held). */
  up(c: number, pedal: boolean): number {
    const i = this.chan[c]
    this.chan[c] = -1
    if (i < 0) return -1
    this.keyHeld[i] = 0
    if (pedal) {
      this.pedalHeld[i] = 1
      return -1
    }
    return i
  }

  /** The oldest voice in a class: 0 dying away, 1 pedal-held, 2 key-held. */
  private oldest(kind: number): number {
    let pick = -1
    let best = Infinity
    for (let i = 0; i < this.voices.length; i++) {
      const k = this.keyHeld[i] ? 2 : this.pedalHeld[i] ? 1 : 0
      if (k === kind && this.stamp[i] < best) {
        best = this.stamp[i]
        pick = i
      }
    }
    return pick
  }
}
