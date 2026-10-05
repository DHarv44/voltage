import type { ModuleSpec } from '../types'
import { BLACK } from './panels'

export const PLANETS = 4
export const ORBITL = { pos: 0, flash: PLANETS * 2, conj: PLANETS * 3 } as const
/** Default radii give orbital periods 1 : 2 : 3 : 4 (Kepler: T ∝ a^1.5). */
const R_DEF = [1, 2, 3, 4].map((k) => (Math.pow(k, 2 / 3) / Math.pow(4, 2 / 3)) * 0.79)

/** A star with up to four planets on real Kepler orbits. A planet crossing the
 *  sensor line (12 o'clock) fires its gate, so the periods (which go as the
 *  orbit radius to the 1.5 power) make natural polyrhythms; CONJ fires when two
 *  planets line up. ECCENTRICITY stretches the orbits: planets rush past the
 *  star and dawdle far out (Kepler's second law), which swings the rhythm.
 *  Drag a planet in or out to change its orbit. */
export const orbit: ModuleSpec = {
  type: 'orbit',
  title: 'ORBIT',
  name: 'Orbital Rhythms',
  tagline: 'Planets on Kepler orbits; each crossing of the sensor is a gate; eccentric orbits swing',
  category: 'Simulations',
  hp: 16,
  panel: BLACK,
  inputs: [
    { id: 'speed', label: 'SPEED' },
    { id: 'reset', label: 'RESET' },
  ],
  outputs: [
    ...Array.from({ length: PLANETS }, (_, i) => ({ id: `g${i + 1}`, label: `G${i + 1}` })),
    { id: 'conj', label: 'CONJ' },
    { id: 'x', label: 'X1' },
    { id: 'y', label: 'Y1' },
  ],
  params: [
    { id: 'planets', label: 'PLANETS', min: 1, max: PLANETS, def: 3, stepped: true },
    { id: 'speed', label: 'SPEED', min: 0.05, max: 4, def: 1, curve: 'exp', unit: 'x' },
    { id: 'ecc', label: 'ECCENTRIC', min: 0, max: 0.7, def: 0.1, unit: '%' },
    ...R_DEF.map((def, i) => ({ id: `r${i + 1}`, label: `ORBIT ${i + 1}`, min: 0.15, max: 1, def })),
  ],
  leds: PLANETS * 3 + 1,
  controls: [
    { kind: 'surface', name: 'orbit', x: 4, y: 15, w: 73.3, h: 50 },
    { kind: 'knob', param: 'planets', x: 12, y: 74, size: 'S' },
    { kind: 'knob', param: 'speed', x: 40, y: 74, size: 'S' },
    { kind: 'knob', param: 'ecc', x: 68, y: 74, size: 'S' },
    { kind: 'in', jack: 'speed', x: 12, y: 92 },
    { kind: 'in', jack: 'reset', x: 26, y: 92 },
    { kind: 'out', jack: 'x', x: 54, y: 98.9 },
    { kind: 'out', jack: 'y', x: 68, y: 98.9 },
    ...Array.from({ length: PLANETS }, (_, i) => ({ kind: 'out' as const, jack: `g${i + 1}`, x: 12 + i * 14, y: 113.5 })),
    { kind: 'out', jack: 'conj', x: 68, y: 113.5 },
  ],
}
