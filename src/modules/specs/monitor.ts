import type { ModuleSpec } from '../types'
import { BLUE } from './panels'

export const monitor: ModuleSpec = {
  type: 'monitor',
  title: 'MONITOR',
  name: 'Monitor Section',
  tagline: 'Output with VU meters, clip lights, MONO check, DIM (−20 dB) and MUTE',
  category: 'Output',
  hp: 8,
  panel: BLUE,
  inputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  outputs: [],
  params: [
    { id: 'vol', label: 'LEVEL', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'mono', label: 'MONO', min: 0, max: 1, def: 0, stepped: true, options: ['ST', 'MONO'] },
    { id: 'dim', label: 'DIM', min: 0, max: 1, def: 0, stepped: true, options: ['', 'DIM'] },
    { id: 'mute', label: 'MUTE', min: 0, max: 1, def: 0, stepped: true, options: ['', 'MUTE'] },
  ],
  leds: 4,
  controls: [
    { kind: 'knob', param: 'vol', x: 20.3, y: 26 },
    { kind: 'text', text: 'L', x: 5, y: 41.6, size: 2 },
    { kind: 'progress', x: 8, y: 41, w: 25, led: 0 },
    { kind: 'led', index: 2, x: 36.5, y: 41, color: '#ff3b2f' },
    { kind: 'text', text: 'R', x: 5, y: 47.6, size: 2 },
    { kind: 'progress', x: 8, y: 47, w: 25, led: 1 },
    { kind: 'led', index: 3, x: 36.5, y: 47, color: '#ff3b2f' },
    { kind: 'switch', param: 'mono', x: 9, y: 64 },
    { kind: 'switch', param: 'dim', x: 20.3, y: 64 },
    { kind: 'switch', param: 'mute', x: 31.6, y: 64 },
    { kind: 'in', jack: 'l', x: 11, y: 90 },
    { kind: 'in', jack: 'r', x: 29.6, y: 90 },
    { kind: 'text', text: 'R ← L', x: 20.3, y: 100, size: 2 },
  ],
}
