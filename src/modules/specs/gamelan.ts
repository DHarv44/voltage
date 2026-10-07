import type { ModuleSpec } from '../types'
import { RED } from './panels'

/** Gamelan tunings in cents (every real set differs; these are typical). */
export const GAMELAN_TUNINGS = [
  { name: 'SLENDRO', cents: [0, 240, 475, 720, 960] },
  { name: 'PELOG', cents: [0, 120, 270, 540, 670, 785, 950] },
]

export interface GamelanInstrument {
  name: string
  partials: { ratio: number; amp: number; decay: number }[]
  decay: number
  /** Octaves spanned (from the base) and the base octave offset. */
  octaves: number
  octave: number
}

export const GAMELAN_INSTRUMENTS: GamelanInstrument[] = [
  {
    // free-free metal bar: modes 1 : 2.76 : 5.40
    name: 'SARON',
    partials: [
      { ratio: 1, amp: 1, decay: 1 },
      { ratio: 2.76, amp: 0.45, decay: 0.45 },
      { ratio: 5.4, amp: 0.2, decay: 0.2 },
    ],
    decay: 2.6,
    octaves: 1,
    octave: 0,
  },
  {
    // bossed kettle gong: strong fundamental, inharmonic rim modes
    name: 'BONANG',
    partials: [
      { ratio: 1, amp: 1, decay: 1 },
      { ratio: 1.52, amp: 0.25, decay: 0.5 },
      { ratio: 2.31, amp: 0.15, decay: 0.3 },
    ],
    decay: 1.9,
    octaves: 2,
    octave: 0,
  },
  {
    name: 'GONG',
    partials: [
      { ratio: 1, amp: 1, decay: 1 },
      { ratio: 1.47, amp: 0.4, decay: 0.7 },
      { ratio: 2.03, amp: 0.3, decay: 0.5 },
      { ratio: 2.44, amp: 0.2, decay: 0.35 },
    ],
    decay: 9,
    octaves: 0,
    octave: -2,
  },
]

export const GAML = { key: 0, flash: 1 } as const

/** Gamelan metallophones. Every key is really two instruments tuned a few Hz
 *  apart (the paired pengumbang/pengisep), so each note beats — the shimmering
 *  ombak; OMBAK sets the beat rate. Saron bars, bonang kettles, or the great
 *  gong (whose pitch sags as it rings). Click the keys or play from CV. */
export const gamelan: ModuleSpec = {
  type: 'gamelan',
  title: 'GAMELAN',
  name: 'Gamelan',
  tagline: 'Saron, bonang or gong in slendro or pelog; paired tuning beats (ombak); click or CV',
  category: 'Instruments',
  hp: 18,
  panel: RED,
  inputs: [
    { id: 'trig', label: 'TRIG' },
    { id: 'voct', label: 'V/OCT' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'pitch', label: 'PITCH' },
    { id: 'gate', label: 'GATE' },
  ],
  params: [
    { id: 'inst', label: 'INSTRUMENT', min: 0, max: 2, def: 0, stepped: true, options: GAMELAN_INSTRUMENTS.map((g) => g.name) },
    { id: 'tuning', label: 'LARAS', min: 0, max: 1, def: 1, stepped: true, options: GAMELAN_TUNINGS.map((t) => t.name) },
    { id: 'base', label: 'BASE', min: -12, max: 12, def: 2, unit: 'st' },
    { id: 'ombak', label: 'OMBAK', min: 0, max: 9, def: 5, unit: 'Hz' },
    { id: 'decay', label: 'RING', min: 0.3, max: 3, def: 1, curve: 'exp', unit: 'x' },
    { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  ],
  leds: 2,
  controls: [
    { kind: 'surface', name: 'gamelan', x: 5, y: 15, w: 81.4, h: 42 },
    { kind: 'switch', param: 'inst', x: 12, y: 70 },
    { kind: 'switch', param: 'tuning', x: 34, y: 70 },
    { kind: 'knob', param: 'base', x: 52, y: 68, size: 'S' },
    { kind: 'knob', param: 'ombak', x: 69, y: 68, size: 'S' },
    { kind: 'knob', param: 'decay', x: 52, y: 88, size: 'S' },
    { kind: 'knob', param: 'level', x: 69, y: 88, size: 'S' },
    { kind: 'in', jack: 'trig', x: 12, y: 104 },
    { kind: 'in', jack: 'voct', x: 26, y: 104 },
    { kind: 'out', jack: 'out', x: 46, y: 113.5 },
    { kind: 'out', jack: 'pitch', x: 60, y: 113.5 },
    { kind: 'out', jack: 'gate', x: 74, y: 113.5 },
  ],
}

/** Keys of an instrument in a tuning: cents above the base, ascending. */
export function gamelanKeys(inst: number, tuning: number): number[] {
  const ins = GAMELAN_INSTRUMENTS[inst]
  const t = GAMELAN_TUNINGS[tuning].cents
  if (ins.octaves === 0) return [ins.octave * 1200]
  const keys: number[] = []
  for (let o = 0; o < ins.octaves; o++) for (const c of t) keys.push((ins.octave + o) * 1200 + c)
  keys.push((ins.octave + ins.octaves) * 1200)
  return keys
}
