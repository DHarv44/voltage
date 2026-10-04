import type { ModuleSpec } from '../types'
import { BLUE } from './panels'
import { QUANT_SCALES } from './shapers'

export const KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
export const TUNEL = {
  /** Detected pitch (V/oct, 0 V = C4), target pitch, voiced flag. */
  heard: 0,
  target: 1,
  voiced: 2,
} as const

/** Pitch corrector (Auto-Tune style). Detects the pitch of a monophonic input
 *  and shifts it onto the nearest note of KEY/SCALE — or onto V/OCT when that's
 *  patched. SPEED 0 is the hard-tuned robot effect; slower is natural. */
export const tune: ModuleSpec = {
  type: 'tune',
  title: 'TUNE',
  name: 'Pitch Corrector',
  tagline: 'Auto-tune any mono source: key + scale or a V/OCT target; SPEED 0 = the hard robotic snap',
  category: 'Effects',
  hp: 12,
  panel: BLUE,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'voct', label: 'V/OCT' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'pitch', label: 'HEARD' },
    { id: 'note', label: 'NOTE' },
    { id: 'gate', label: 'VOICED' },
  ],
  params: [
    { id: 'key', label: 'KEY', min: 0, max: 11, def: 0, stepped: true, options: KEY_NAMES },
    { id: 'scale', label: 'SCALE', min: 0, max: QUANT_SCALES.length - 1, def: 0, stepped: true, options: QUANT_SCALES },
    { id: 'speed', label: 'SPEED', min: 0, max: 0.4, def: 0.02, unit: 's' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 1, unit: '%' },
  ],
  leds: 3,
  controls: [
    { kind: 'surface', name: 'tuner', x: 5, y: 15, w: 50.96, h: 24 },
    { kind: 'knob', param: 'key', x: 17, y: 50 },
    { kind: 'knob', param: 'scale', x: 44, y: 50 },
    { kind: 'knob', param: 'speed', x: 17, y: 71, size: 'S' },
    { kind: 'knob', param: 'mix', x: 44, y: 71, size: 'S' },
    { kind: 'in', jack: 'in', x: 15, y: 96 },
    { kind: 'in', jack: 'voct', x: 30.5, y: 96 },
    { kind: 'out', jack: 'gate', x: 46, y: 96 },
    { kind: 'out', jack: 'out', x: 12, y: 113.5 },
    { kind: 'out', jack: 'pitch', x: 30.5, y: 113.5 },
    { kind: 'out', jack: 'note', x: 49, y: 113.5 },
  ],
}
