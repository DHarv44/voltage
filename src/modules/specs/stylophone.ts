import type { ModuleSpec } from '../types'
import { BLACK } from './panels'

/** 20 keys, A3 to E5 chromatic (semitones from C4). */
export const STYLO_KEYS = Array.from({ length: 20 }, (_, i) => -3 + i)
export const STYLOL = { key: 0 } as const

/** Stylus organ (Stylophone-style). Touch the metal keys with the stylus (drag
 *  along the strip). The tone is a relaxation oscillator — a capacitor charging
 *  and snapping back — so it's a raw, buzzy ramp, played through a tiny
 *  speaker; VIBRATO is the original's wobble switch. GATE/PITCH drive the rack. */
export const stylophone: ModuleSpec = {
  type: 'stylophone',
  title: 'STYLUS',
  name: 'Stylus Organ',
  tagline: 'Pocket stylus organ: drag the stylus along a metal keyboard; buzzy relaxation oscillator, vibrato',
  category: 'Sources',
  hp: 16,
  panel: BLACK,
  inputs: [],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'pitch', label: 'PITCH' },
    { id: 'gate', label: 'GATE' },
  ],
  params: [
    { id: 'tune', label: 'TUNE', min: -1, max: 1, def: 0, unit: 'st' },
    { id: 'octave', label: 'OCTAVE', min: 0, max: 2, def: 1, stepped: true, options: ['LOW', 'MID', 'HIGH'] },
    { id: 'vib', label: 'VIBRATO', min: 0, max: 1, def: 0, stepped: true, options: ['OFF', 'ON'] },
    { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.7, unit: '%' },
  ],
  leds: 1,
  controls: [
    { kind: 'surface', name: 'stylophone', x: 4, y: 16, w: 73.3, h: 48 },
    { kind: 'knob', param: 'tune', x: 12, y: 77, size: 'S' },
    { kind: 'switch', param: 'octave', x: 30, y: 78 },
    { kind: 'switch', param: 'vib', x: 50, y: 78 },
    { kind: 'knob', param: 'level', x: 68, y: 77, size: 'S' },
    { kind: 'out', jack: 'pitch', x: 40, y: 113.5 },
    { kind: 'out', jack: 'gate', x: 54, y: 113.5 },
    { kind: 'out', jack: 'out', x: 68, y: 113.5 },
  ],
}
