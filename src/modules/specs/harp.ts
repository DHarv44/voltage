import type { ModuleSpec } from '../types'
import { CREAM } from './panels'

/** Major keys the pedals can set, as sharps (+) / flats (−) per letter C D E F G A B. */
export const HARP_KEYS: { name: string; acc: number[] }[] = [
  { name: 'C', acc: [0, 0, 0, 0, 0, 0, 0] },
  { name: 'G', acc: [0, 0, 0, 1, 0, 0, 0] },
  { name: 'D', acc: [1, 0, 0, 1, 0, 0, 0] },
  { name: 'A', acc: [1, 0, 0, 1, 1, 0, 0] },
  { name: 'E', acc: [1, 1, 0, 1, 1, 0, 0] },
  { name: 'F', acc: [0, 0, 0, 0, 0, 0, -1] },
  { name: 'B♭', acc: [0, 0, -1, 0, 0, 0, -1] },
  { name: 'E♭', acc: [0, 0, -1, 0, 0, -1, -1] },
  { name: 'A♭', acc: [0, -1, -1, 0, 0, -1, -1] },
]
const LETTER_SEMI = [0, 2, 4, 5, 7, 9, 11]
export const HARP_STRINGS = 36
/** Lowest string: C2 (semitones from C4). */
const LOW = -24

/** Semitones from C4 for string i in a key. */
export function harpSemi(i: number, key: number): number {
  const letter = i % 7
  return LOW + Math.floor(i / 7) * 12 + LETTER_SEMI[letter] + (HARP_KEYS[key]?.acc[letter] ?? 0)
}

export const HARPL = { string: 0, flash: 1 } as const

/** Concert harp: 36 strings C2–C7. Drag across them for a glissando (every
 *  string you cross sounds), click to pluck one; KEY sets the pedals (sharps
 *  and flats). Strings are plucked waveguides: low ones ring long, high ones
 *  short, BRIGHT moves the pluck toward the soundboard (twangier). C strings
 *  are red and F strings blue, as on a real harp. */
export const harp: ModuleSpec = {
  type: 'harp',
  title: 'HARP',
  name: 'Concert Harp',
  tagline: '36 plucked strings: glissando by dragging across, pedals set the key, CV plays the nearest string',
  category: 'Instruments',
  hp: 22,
  panel: CREAM,
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
    { id: 'key', label: 'KEY', min: 0, max: HARP_KEYS.length - 1, def: 0, stepped: true, options: HARP_KEYS.map((k) => k.name) },
    { id: 'sustain', label: 'SUSTAIN', min: 0.3, max: 3, def: 1, curve: 'exp', unit: 'x' },
    { id: 'bright', label: 'BRIGHT', min: 0, max: 1, def: 0.4, unit: '%' },
    { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  ],
  leds: 2,
  controls: [
    { kind: 'surface', name: 'harp', x: 5, y: 15, w: 101.8, h: 66 },
    { kind: 'knob', param: 'key', x: 14, y: 92 },
    { kind: 'knob', param: 'sustain', x: 34, y: 92, size: 'S' },
    { kind: 'knob', param: 'bright', x: 50, y: 92, size: 'S' },
    { kind: 'knob', param: 'level', x: 66, y: 92, size: 'S' },
    { kind: 'in', jack: 'trig', x: 12, y: 113 },
    { kind: 'in', jack: 'voct', x: 26, y: 113 },
    { kind: 'out', jack: 'out', x: 72, y: 113.5 },
    { kind: 'out', jack: 'pitch', x: 86, y: 113.5 },
    { kind: 'out', jack: 'gate', x: 100, y: 113.5 },
  ],
}
