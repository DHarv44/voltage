import type { ModuleSpec } from '../types'
import { SAND } from './panels'

/** Room floor plan at SIZE 1 (metres) and the ceiling height. */
export const ROOM = { w: 8, d: 6, h: 3.5 }

/** Echo chamber: a real room with a speaker and a stereo pair of mics. Drag
 *  them around the floor plan: the early reflections are computed from the
 *  room's geometry (image sources), the tail from its volume and absorption
 *  (Sabine). Moving the speaker while it plays bends the pitch (Doppler). */
export const chamber: ModuleSpec = {
  type: 'chamber',
  title: 'ECHO CHAMBER',
  name: 'Echo Chamber',
  tagline: 'A real room: drag the speaker and mics; reflections from geometry, tail from volume and walls',
  category: 'Effects',
  hp: 20,
  panel: SAND,
  inputs: [{ id: 'in', label: 'IN' }],
  outputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  params: [
    { id: 'size', label: 'SIZE', min: 0.3, max: 3, def: 1, curve: 'exp', unit: 'x' },
    { id: 'damp', label: 'WALLS', min: 0, max: 1, def: 0.25, unit: '%' },
    { id: 'width', label: 'MIC GAP', min: 0, max: 1, def: 0.35, unit: '%' },
    { id: 'tail', label: 'TAIL', min: 0, max: 1, def: 0.7, unit: '%' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'sx', label: 'SPEAKER X', min: 0, max: 1, def: 0.25, unit: '%' },
    { id: 'sy', label: 'SPEAKER Y', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'mx', label: 'MIC X', min: 0, max: 1, def: 0.72, unit: '%' },
    { id: 'my', label: 'MIC Y', min: 0, max: 1, def: 0.5, unit: '%' },
  ],
  controls: [
    { kind: 'surface', name: 'room', x: 5, y: 15, w: 91.6, h: 52 },
    { kind: 'knob', param: 'size', x: 14, y: 78, size: 'S' },
    { kind: 'knob', param: 'damp', x: 32, y: 78, size: 'S' },
    { kind: 'knob', param: 'width', x: 50, y: 78, size: 'S' },
    { kind: 'knob', param: 'tail', x: 68, y: 78, size: 'S' },
    { kind: 'knob', param: 'mix', x: 86, y: 78, size: 'S' },
    { kind: 'in', jack: 'in', x: 20, y: 105 },
    { kind: 'out', jack: 'l', x: 62, y: 113.5 },
    { kind: 'out', jack: 'r', x: 80, y: 113.5 },
  ],
}
