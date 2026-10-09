import { patPre, POCKET_CHAIN, POCKET_PATTERNS, SONGL } from '../../modules/specs/pocketShared'

/** A POCKET's patterns and chain: which of A–D plays. It changes only at a
 *  bar (step 1), so a pattern picked while playing waits for the bar to end;
 *  with SONG on, each bar plays the next pattern in the chain. */
export class PocketSong {
  playing = 0
  /** The chain slot playing (−1: not playing a chain). */
  private slot = -1
  private wasOn = false
  private readonly pPat: number
  private readonly pOn: number
  private readonly pLen: number
  private readonly pCh0: number
  /** The melodic POCKETs keep a pattern as one block (mask, notes, flags):
   *  the playing pattern's mask, first note and first flag param. */
  mask = 0
  note = 0
  flag = 0
  private readonly offs: Int32Array

  constructor(pi: (id: string) => number, block = false) {
    this.pPat = pi('pat')
    this.pOn = pi('chon')
    this.pLen = pi('chlen')
    this.pCh0 = pi('ch0')
    if (block) {
      this.mask = pi('m')
      this.note = pi('n0')
      this.flag = pi('f0')
    }
    const a = this.mask
    this.offs = Int32Array.from(POCKET_PATTERNS, (_, k) => (block ? pi(`${patPre(k)}m`) - a : 0))
  }

  /** Started over (RST, or PLAY): a chain begins again from its first slot. */
  reset(): void {
    this.slot = -1
  }

  /** A new bar: pick the pattern. True if it's a different one. */
  bar(p: Float64Array): boolean {
    const on = p[this.pOn] >= 0.5
    if (on && !this.wasOn) this.slot = -1
    this.wasOn = on
    let next: number
    if (on) {
      const len = Math.max(1, Math.min(POCKET_CHAIN, Math.round(p[this.pLen])))
      this.slot = (this.slot + 1) % len
      next = Math.round(p[this.pCh0 + this.slot])
    } else {
      this.slot = -1
      next = Math.round(p[this.pPat])
    }
    next = Math.max(0, Math.min(POCKET_PATTERNS.length - 1, next))
    const changed = next !== this.playing
    if (changed) {
      const d = this.offs[next] - this.offs[this.playing]
      this.mask += d
      this.note += d
      this.flag += d
    }
    this.playing = next
    return changed
  }

  /** Telemetry from `base`: pattern, chain slot, the effect held. */
  leds(led: Float32Array, base: number, fx: number): void {
    led[base + SONGL.pat] = this.playing
    led[base + SONGL.slot] = this.slot
    led[base + SONGL.fx] = fx
  }
}
