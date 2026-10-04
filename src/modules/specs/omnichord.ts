import type { ModuleSpec } from '../types'
import { CREAM } from './panels'

/** Chord buttons in the Omnichord's circle-of-fifths order, and the three rows. */
export const OMNI_ROOTS = ['E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E']
export const OMNI_ROOT_SEMIS = [3, 10, 5, 0, 7, 2, 9, 4]
export const OMNI_TYPES = ['MAJ', 'MIN', '7TH']
export const OMNI_ZONES = 13

export const OML = {
  root: 0,
  type: 1,
  held: 2,
  /** Last strummed zone (−1 none) and a decaying flash. */
  zone: 3,
  flash: 4,
} as const

const KX = [14, 34, 54, 74, 94]
const OX = [12, 29, 46, 63, 80, 97, 114, 131]

/** Omnichord-style electronic autoharp. Hold a chord button for a chord pad
 *  with auto-bass; swipe the strum plate for harp plucks of that chord across
 *  four octaves (the last chord is remembered). NOTES carries the chord on a
 *  poly cable; PITCH and STRUM follow each pluck. */
export const omnichord: ModuleSpec = {
  type: 'omnichord',
  title: 'OMNICHORD',
  name: 'Omnichord',
  tagline: 'Electronic autoharp: chord buttons + strum plate, auto-bass pad, harp plucks, chord on a poly cable',
  category: 'Sources',
  hp: 28,
  panel: CREAM,
  inputs: [],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'chord', label: 'CHORD' },
    { id: 'harp', label: 'HARP' },
    { id: 'root', label: 'ROOT' },
    { id: 'gate', label: 'GATE' },
    { id: 'strum', label: 'STRUM' },
    { id: 'pitch', label: 'PITCH' },
    { id: 'notes', label: 'NOTES', poly: true },
  ],
  params: [
    { id: 'chord', label: 'CHORD', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'bass', label: 'BASS', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'harp', label: 'HARP', min: 0, max: 1, def: 0.8, unit: '%' },
    { id: 'sustain', label: 'SUSTAIN', min: 0.15, max: 4, def: 1.2, curve: 'exp', unit: 's' },
    { id: 'tone', label: 'TONE', min: 0, max: 1, def: 0.5, unit: '%' },
  ],
  leds: 5,
  controls: [
    { kind: 'surface', name: 'omnichord', x: 4, y: 15, w: 134.2, h: 62 },
    ...['chord', 'bass', 'harp', 'sustain', 'tone'].map((param, i) => ({ kind: 'knob' as const, param, x: KX[i], y: 88, size: 'S' as const })),
    ...['out', 'chord', 'harp', 'root', 'gate', 'strum', 'pitch', 'notes'].map((jack, i) => ({ kind: 'out' as const, jack, x: OX[i], y: 113 })),
  ],
}
