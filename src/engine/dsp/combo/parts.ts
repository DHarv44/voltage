import { styleOf } from '../../../modules/specs/combo/genres'
import { changeId, COMBO_PARTS, MAX_BEATS, MAX_CHANGES, partId, PART_FIELDS, type PartField } from '../../../modules/specs/combo/params'
import { swung } from '../../../modules/specs/combo/style'
import type { BandPart, PartFeel } from './band'
import type { Learned } from './analyse'

/** Param indices of one part's fields and chord changes. */
interface PartIdx {
  f: Record<PartField, number>
  c: Int32Array
}

/** COMBO's five song parts, kept in the module's params (so they're saved
 *  with the rack) and mirrored into the band's form: rebuilt whenever a
 *  part's version changes (a new learn, or a rack loaded). */
export class PartBank {
  readonly parts: BandPart[]
  readonly feels: PartFeel[]
  readonly idx: PartIdx[]
  private readonly seen = new Float64Array(COMBO_PARTS).fill(-1)

  constructor(pi: (id: string) => number) {
    this.parts = Array.from({ length: COMBO_PARTS }, () => ({ beats: 0, meter: 4, bpm: 100, chords: new Int16Array(MAX_BEATS).fill(-1) }))
    this.feels = Array.from({ length: COMBO_PARTS }, () => ({ style: styleOf(0, 0), alt: 1, hi: false, bassMode: 0 }))
    this.idx = Array.from({ length: COMBO_PARTS }, (_, i) => {
      const f = {} as Record<PartField, number>
      for (const k of PART_FIELDS) f[k] = pi(partId(k, i))
      const c = new Int32Array(MAX_CHANGES)
      for (let k = 0; k < MAX_CHANGES; k++) c[k] = pi(changeId(i, k))
      return { f, c }
    })
  }

  learned(i: number): boolean {
    return this.parts[i].beats > 0
  }

  /** Bring the band's copy up to date with the params (cheap when nothing changed). */
  sync(p: Float64Array): void {
    for (let i = 0; i < COMBO_PARTS; i++) {
      const f = this.idx[i].f
      const part = this.parts[i]
      if (p[f.v] !== this.seen[i] || Math.round(p[f.n]) !== part.beats) {
        this.seen[i] = p[f.v]
        part.beats = Math.round(p[f.n])
        part.meter = Math.round(p[f.m]) === 3 ? 3 : 4
        part.bpm = p[f.t]
        // chords: hold each change until the next one
        part.chords.fill(-1)
        for (let k = 0; k < MAX_CHANGES; k++) {
          const v = Math.round(p[this.idx[i].c[k]])
          if (v <= 0) continue
          const beat = Math.floor(v / 256)
          if (beat < MAX_BEATS) part.chords[beat] = (v % 256) - 1
        }
        let cur = -1
        for (let b = part.beats - 1; b >= 0 && cur < 0; b--) cur = part.chords[b]
        for (let b = 0; b < part.beats; b++) {
          if (part.chords[b] >= 0) cur = part.chords[b]
          else part.chords[b] = cur
        }
      }
      // how it plays: these can change any time
      const feel = this.feels[i]
      feel.style = styleOf(p[f.g], p[f.s])
      feel.hi = p[f.h] >= 0.5
      feel.bassMode = Math.round(p[f.b])
      // ALT TIME: double a slow learned pulse, halve a fast one
      feel.alt = p[f.a] >= 0.5 ? (part.bpm < 100 ? 2 : 0.5) : 1
    }
  }

  /** Store a learned part (through `write`, so it reaches the saved rack). */
  store(i: number, l: Learned, p: Float64Array, write: (idx: number, v: number) => void): void {
    const f = this.idx[i].f
    write(f.n, l.beats)
    write(f.m, l.meter)
    write(f.t, Math.round(l.bpm * 10) / 10)
    write(f.w, l.swing ? 1 : 0)
    let k = 0
    for (let b = 0; b < l.beats && k < MAX_CHANGES; b++) if (b === 0 || l.chords[b] !== l.chords[b - 1]) write(this.idx[i].c[k++], b * 256 + l.chords[b] + 1)
    for (; k < MAX_CHANGES; k++) if (p[this.idx[i].c[k]] !== 0) write(this.idx[i].c[k], 0)
    write(f.v, p[f.v] + 1)
  }

  /** Forget a part. */
  clear(i: number, p: Float64Array, write: (idx: number, v: number) => void): void {
    write(this.idx[i].f.n, 0)
    write(this.idx[i].f.v, p[this.idx[i].f.v] + 1)
  }
}

/** The style suggestions for a part (TRIO-style lights round the STYLE
 *  knob): 2 where a style's meter and feel match how it was played, 1 where
 *  only the meter does, 0 otherwise. */
export function styleHints(genre: number, meter: number, swing: boolean, out: Float32Array, at: number): void {
  for (let s = 0; s < 12; s++) {
    const st = styleOf(genre, s)
    const m = st.beats === meter
    out[at + s] = !m ? 0 : swung(st) === swing ? 2 : 1
  }
}
