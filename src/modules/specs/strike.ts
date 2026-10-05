import type { ModuleSpec } from '../types'
import { BLACK } from './panels'

export interface StrikeNote {
  /** Semitones from C4. */
  semi: number
  /** Centre on the instrument face (0..1 of the surface) and radius. */
  x: number
  y: number
  r: number
}

export interface StrikeInstrument {
  name: string
  partials: { ratio: number; amp: number; decay: number }[]
  /** Fundamental decay in seconds and default mallet brightness. */
  decay: number
  bright: number
  notes: StrikeNote[]
}

const ring = (semis: number[], radius: number, r: number, startDeg = -90): StrikeNote[] =>
  semis.map((semi, i) => {
    const a = ((startDeg + (360 * i) / semis.length) * Math.PI) / 180
    return { semi, x: 0.5 + Math.cos(a) * radius * 0.62, y: 0.5 + Math.sin(a) * radius, r }
  })

/** D Kurd 9 handpan: the ding in the middle, eight notes zig-zagging round. */
const HANDPAN: StrikeNote[] = [
  { semi: -10, x: 0.5, y: 0.5, r: 0.13 },
  ...[-3, -2, 0, 2, 4, 5, 7, 9].map((semi, i) => {
    const side = i % 2 === 0 ? 1 : -1
    const a = ((90 + side * (25 + Math.floor(i / 2) * 38)) * Math.PI) / 180
    return { semi, x: 0.5 + Math.cos(a) * 0.36 * 0.62, y: 0.5 + Math.sin(a) * 0.36, r: 0.085 }
  }),
]

/** Tenor steel pan: rings in circle-of-fifths order (as real pans are laid out). */
const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]
const STEELPAN: StrikeNote[] = [
  ...ring(FIFTHS, 0.42, 0.06),
  ...ring(
    FIFTHS.map((s) => s + 12),
    0.28,
    0.05,
  ),
  ...ring([24, 31, 26, 33, 28], 0.13, 0.045),
]

/** 17-key kalimba: low in the middle, alternating outward. */
const KALIMBA_SEMIS = [26, 23, 19, 16, 12, 9, 5, 2, 0, 4, 7, 11, 14, 17, 21, 24, 28]
const KALIMBA: StrikeNote[] = KALIMBA_SEMIS.map((semi, i) => {
  const fromCentre = Math.abs(i - 8)
  return { semi, x: 0.08 + (0.84 * i) / 16, y: 0.3 + fromCentre * 0.035, r: 0.025 }
})

export const STRIKE_INSTRUMENTS: StrikeInstrument[] = [
  {
    name: 'HANDPAN',
    partials: [
      { ratio: 1, amp: 1, decay: 1 },
      { ratio: 2, amp: 0.5, decay: 0.7 },
      { ratio: 3, amp: 0.3, decay: 0.4 },
    ],
    decay: 4,
    bright: 0.45,
    notes: HANDPAN,
  },
  {
    name: 'STEEL PAN',
    partials: [
      { ratio: 1, amp: 1, decay: 1 },
      { ratio: 2, amp: 0.6, decay: 0.6 },
      { ratio: 3, amp: 0.35, decay: 0.35 },
    ],
    decay: 1.6,
    bright: 0.8,
    notes: STEELPAN,
  },
  {
    name: 'KALIMBA',
    partials: [
      { ratio: 1, amp: 1, decay: 1 },
      { ratio: 5.8, amp: 0.25, decay: 0.2 },
      { ratio: 14.1, amp: 0.08, decay: 0.06 },
    ],
    decay: 2.5,
    bright: 0.6,
    notes: KALIMBA,
  },
]

export const STRIKEL = { note: 0, flash: 1 } as const

/** Tuned struck instruments: handpan (D Kurd), tenor steel pan (fifths
 *  layout) and kalimba. Click the face to play (nearer the centre of a note =
 *  harder), or TRIG with V/OCT picks the nearest note of the instrument. Every
 *  note is its own resonator: hitting a ringing note adds to it. */
export const strike: ModuleSpec = {
  type: 'strike',
  title: 'STRIKE',
  name: 'Handpan · Steel Pan · Kalimba',
  tagline: 'Tap a handpan, steel pan or kalimba (or play it from CV): every note a ringing resonator',
  category: 'Sources',
  hp: 20,
  panel: BLACK,
  inputs: [
    { id: 'trig', label: 'TRIG' },
    { id: 'voct', label: 'V/OCT' },
    { id: 'vel', label: 'VEL' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'pitch', label: 'PITCH' },
    { id: 'gate', label: 'GATE' },
  ],
  params: [
    { id: 'inst', label: 'INSTRUMENT', min: 0, max: 2, def: 0, stepped: true, options: STRIKE_INSTRUMENTS.map((s) => s.name) },
    { id: 'decay', label: 'RING', min: 0.3, max: 3, def: 1, curve: 'exp', unit: 'x' },
    { id: 'bright', label: 'MALLET', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  ],
  leds: 2,
  controls: [
    { kind: 'surface', name: 'strike', x: 5, y: 15, w: 91.6, h: 62 },
    { kind: 'switch', param: 'inst', x: 12, y: 87 },
    { kind: 'knob', param: 'decay', x: 40, y: 87, size: 'S' },
    { kind: 'knob', param: 'bright', x: 58, y: 87, size: 'S' },
    { kind: 'knob', param: 'level', x: 76, y: 87, size: 'S' },
    { kind: 'in', jack: 'trig', x: 12, y: 113.5 },
    { kind: 'in', jack: 'voct', x: 26, y: 113.5 },
    { kind: 'in', jack: 'vel', x: 40, y: 113.5 },
    { kind: 'out', jack: 'out', x: 60, y: 113.5 },
    { kind: 'out', jack: 'pitch', x: 74, y: 113.5 },
    { kind: 'out', jack: 'gate', x: 88, y: 113.5 },
  ],
}
