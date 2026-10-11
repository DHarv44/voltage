import type { ModuleSpec, ParamSpec } from '../types'
import { opts, simpleSpec } from './build'
import { CREAM } from './panels'

export const TUNING_NAMES = ['EQUAL', 'JUST', 'PYTHAGOREAN', 'MEANTONE', 'WERCKMEISTER', '19-EDO', '24-EDO', 'SLENDRO', 'PELOG', 'BOHLEN-PIERCE', 'SCALA']
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
/** The most degrees a loaded Scala file keeps (the last is its period). */
export const SCALA_MAX = 48

const ratio = (a: number, b: number) => 1200 * Math.log2(a / b)
const edo = (n: number, period = 1200) => Array.from({ length: n }, (_, i) => (i * period) / n)

/** Each tuning: its degrees (cents above the root) and its period (cents: an octave, or BP's tritave). */
export const TUNINGS: { degrees: number[]; period: number }[] = [
  { degrees: edo(12), period: 1200 },
  { degrees: [ratio(1, 1), ratio(16, 15), ratio(9, 8), ratio(6, 5), ratio(5, 4), ratio(4, 3), ratio(45, 32), ratio(3, 2), ratio(8, 5), ratio(5, 3), ratio(9, 5), ratio(15, 8)], period: 1200 },
  { degrees: [0, 90.2, 203.9, 294.1, 407.8, 498, 611.7, 702, 792.2, 905.9, 996.1, 1109.8], period: 1200 },
  { degrees: [0, 76, 193.2, 310.3, 386.3, 503.4, 579.5, 696.6, 772.6, 889.7, 1006.8, 1082.9], period: 1200 },
  { degrees: [0, 90.2, 192.2, 294.1, 390.2, 498, 588.3, 696.1, 792.2, 888.3, 996.1, 1092.2], period: 1200 },
  { degrees: edo(19), period: 1200 },
  { degrees: edo(24), period: 1200 },
  { degrees: [0, 240, 480, 720, 960], period: 1200 },
  { degrees: [0, 120, 270, 540, 670, 785, 950], period: 1200 },
  { degrees: edo(13, ratio(3, 1)), period: ratio(3, 1) },
]

/** TUNING: retunes notes on a cable. */
export const tuning: ModuleSpec = simpleSpec({
  type: 'tuning',
  title: 'TUNING',
  name: 'Tuning / Microtonal',
  tagline: 'Retunes a (poly) V/OCT cable: just intonation, historical temperaments, 19 and 24 notes to the octave, gamelan scales, Bohlen-Pierce, or any Scala file',
  category: 'CV Tools',
  hp: 8,
  panel: CREAM,
  params: [
    opts('preset', 'TUNING', TUNING_NAMES, 1),
    opts('root', 'ROOT', NOTE_NAMES, 0),
    opts('snap', 'IN', ['NOTES', 'GLIDES'], 0),
    { id: 'sn', label: 'SCALA NOTES', min: 1, max: SCALA_MAX, def: 12, stepped: true },
    ...Array.from({ length: SCALA_MAX }, (_, i): ParamSpec => ({ id: `s${i}`, label: `SCALA ${i + 1}`, min: -1200, max: 4800, def: (i + 1) * 100 })),
  ],
  inputs: [{ id: 'voct', label: 'V/OCT', poly: true }],
  outputs: [{ id: 'out', label: 'OUT', poly: true }],
  rows: [['kl:preset'], ['k:root', 's:snap'], ['f:0:LOAD .SCL:scl'], ['i:voct', 'o:out']],
})
