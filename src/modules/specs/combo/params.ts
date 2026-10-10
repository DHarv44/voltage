import type { ParamSpec } from '../../types'
import { GENRE_NAMES } from './genres'

/** Song parts COMBO can learn, and the chord changes each can hold. */
export const COMBO_PARTS = 5
export const MAX_CHANGES = 64
/** Longest part (beats): 48 bars of 4. */
export const MAX_BEATS = 192

/** A part's stored fields (param `${field}${part}`):
 *  n beats (0 = not learned) · m meter · t learned tempo · w swung (0/1) ·
 *  g genre · s style · a ALT TIME · b bass mode · h high intensity ·
 *  v version (bumped on every learn, so the engine rebuilds it). Its chords
 *  are `c${part}_${k}`: beat × 256 + chord code + 1 at each change (0 unused). */
export const PART_FIELDS = ['n', 'm', 't', 'w', 'g', 's', 'a', 'b', 'h', 'v'] as const
export type PartField = (typeof PART_FIELDS)[number]
export const partId = (field: PartField, part: number): string => `${field}${part}`
export const changeId = (part: number, k: number): string => `c${part}_${k}`

export const BASS_MODES = ['ACTIVE', 'ROOTS', 'BAR']

const range: Record<PartField, [number, number, number]> = {
  n: [0, MAX_BEATS, 0],
  m: [3, 4, 4],
  t: [30, 260, 100],
  w: [0, 1, 0],
  g: [0, GENRE_NAMES.length - 1, 2],
  s: [0, 11, 0],
  a: [0, 1, 0],
  b: [0, 2, 0],
  h: [0, 1, 0],
  v: [0, 1e6, 0],
}

/** The panel's own params (they act on the selected part) and the stored parts. */
export function comboParams(): ParamSpec[] {
  const panel: ParamSpec[] = [
    { id: 'genre', label: 'GENRE', min: 0, max: GENRE_NAMES.length - 1, def: 2, stepped: true, options: GENRE_NAMES },
    { id: 'style', label: 'STYLE', min: 0, max: 11, def: 0, stepped: true },
    { id: 'tempo', label: 'TEMPO', min: -50, max: 50, def: 0, unit: '%' },
    { id: 'alt', label: 'ALT TIME', min: 0, max: 1, def: 0, stepped: true, options: ['OFF', 'ALT'] },
    { id: 'sbass', label: 'BASS', min: 0, max: 2, def: 0, stepped: true, options: BASS_MODES },
    { id: 'count', label: 'COUNT-IN', min: 0, max: 1, def: 1, stepped: true, options: ['OFF', 'ON'] },
    { id: 'part', label: 'PART', min: 0, max: COMBO_PARTS - 1, def: 0, stepped: true },
    // the band playing or not, kept with the rack (like CLOCK's RUN)
    { id: 'run', label: 'PLAYING', min: 0, max: 1, def: 0, stepped: true },
  ]
  const parts: ParamSpec[] = []
  for (let i = 0; i < COMBO_PARTS; i++) {
    for (const f of PART_FIELDS) {
      const [min, max, def] = range[f]
      parts.push({ id: partId(f, i), label: `PART ${i + 1} ${f.toUpperCase()}`, min, max, def, stepped: f !== 't' })
    }
    for (let k = 0; k < MAX_CHANGES; k++) parts.push({ id: changeId(i, k), label: `PART ${i + 1} CHORD ${k + 1}`, min: 0, max: 1e6, def: 0, stepped: true })
  }
  return [...panel, ...parts]
}

/** What the engine tells COMBO's screen (LED channel). */
export const CL = {
  /** 0 idle · 1 learning · 2 playing · 3 couldn't learn · 4 counting in. */
  status: 0,
  /** The part playing (or about to), the part cued next (−1), the one selected. */
  part: 1,
  cued: 2,
  sel: 3,
  /** Where in the part (learned beats), how long it is, its meter. */
  beat: 4,
  beats: 5,
  meter: 6,
  /** The chord sounding (code, −1 none), the tempo playing, seconds learned so far. */
  chord: 7,
  bpm: 8,
  learnT: 9,
  /** Why learning failed (index into LEARN_FAILS). */
  why: 10,
  /** Each part: 0 empty · 1 learned · 2 learned, high intensity. */
  parts: 11,
  /** Each style of the genre: 0 · 1 meter matches (amber) · 2 meter and feel (green). */
  hints: 16,
  /** Each part's loop: 0 none · 1 recording · 2 playing · 3 overdubbing · 4 stopped. */
  loops: 28,
  /** The BAND button's light (on while learning, pulsing on the beat while playing). */
  bandLed: 33,
} as const
export const COMBO_LEDS = 34
export const LEARN_FAILS = ['TOO SHORT', 'NOTHING HEARD', 'TEMPO?', 'NO CHORDS', 'TOO LONG']
