import type { ModuleSpec } from '../types'
import { ALU } from './panels'

export const vca: ModuleSpec = {
  type: 'vca',
  title: 'VCA',
  name: 'Amplifier',
  tagline: 'Voltage-controlled amp, lin/exp response, rail saturation',
  category: 'Amplifiers',
  hp: 6,
  panel: ALU,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'CV' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'gain', label: 'LEVEL', min: 0, max: 1, def: 0, unit: '%' },
    { id: 'cv', label: 'CV', min: 0, max: 1, def: 1, unit: '%' },
    { id: 'resp', label: 'RESPONSE', min: 0, max: 1, def: 0, stepped: true, options: ['LIN', 'EXP'] },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'gain', x: 15.24, y: 26 },
    { kind: 'knob', param: 'cv', x: 15.24, y: 44, size: 'S' },
    { kind: 'switch', param: 'resp', x: 15.24, y: 60 },
    { kind: 'led', index: 0, x: 15.24, y: 74, color: '#ff3b2f' },
    { kind: 'in', jack: 'in', x: 8.5, y: 88 },
    { kind: 'in', jack: 'cv', x: 22, y: 88 },
    { kind: 'out', jack: 'out', x: 15.24, y: 108 },
  ],
}
