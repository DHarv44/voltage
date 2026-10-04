import type { ModuleSpec } from '../types'
import { ALU } from './panels'

export const ring: ModuleSpec = {
  type: 'ring',
  title: 'RING',
  name: 'Ring Modulator',
  tagline: 'Diode-ring modulator with tracking carrier oscillator: bells, metal, steel drums',
  category: 'Shapers',
  hp: 6,
  panel: ALU,
  inputs: [
    { id: 'x', label: 'IN' },
    { id: 'y', label: 'CARR' },
    { id: 'voct', label: '1V/OCT' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'osc', label: 'OSC' },
  ],
  params: [
    { id: 'freq', label: 'FREQ', min: 20, max: 5000, def: 440, curve: 'exp', unit: 'Hz' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 1, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'freq', x: 15.24, y: 26 },
    { kind: 'knob', param: 'mix', x: 15.24, y: 44, size: 'S' },
    { kind: 'text', text: 'CARR ← OSC', x: 15.24, y: 55, size: 1.8 },
    { kind: 'in', jack: 'x', x: 8.5, y: 69 },
    { kind: 'in', jack: 'y', x: 22, y: 69 },
    { kind: 'in', jack: 'voct', x: 8.5, y: 89 },
    { kind: 'out', jack: 'osc', x: 22, y: 89 },
    { kind: 'out', jack: 'out', x: 15.24, y: 108 },
  ],
}
