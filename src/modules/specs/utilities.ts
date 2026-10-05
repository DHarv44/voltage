import type { ModuleSpec } from '../types'
import { ALU, BLACK } from './panels'

export const noise: ModuleSpec = {
  type: 'noise',
  title: 'NOISE',
  name: 'Noise Source',
  tagline: 'White, pink and red noise',
  category: 'Sources',
  hp: 4,
  panel: BLACK,
  inputs: [],
  outputs: [
    { id: 'white', label: 'WHITE' },
    { id: 'pink', label: 'PINK' },
    { id: 'red', label: 'RED' },
  ],
  params: [],
  controls: [
    { kind: 'out', jack: 'white', x: 10.16, y: 52 },
    { kind: 'out', jack: 'pink', x: 10.16, y: 76 },
    { kind: 'out', jack: 'red', x: 10.16, y: 100 },
  ],
}

export const mixer: ModuleSpec = {
  type: 'mixer',
  title: 'MIX',
  name: 'Mixer',
  tagline: 'Four-channel DC mixer with inverted output',
  category: 'Utilities',
  hp: 8,
  panel: ALU,
  inputs: [
    { id: 'in1', label: '1' },
    { id: 'in2', label: '2' },
    { id: 'in3', label: '3' },
    { id: 'in4', label: '4' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'inv', label: 'INV' },
  ],
  params: [
    { id: 'l1', label: 'LEVEL 1', min: 0, max: 1, def: 0.8, unit: '%' },
    { id: 'l2', label: 'LEVEL 2', min: 0, max: 1, def: 0.8, unit: '%' },
    { id: 'l3', label: 'LEVEL 3', min: 0, max: 1, def: 0.8, unit: '%' },
    { id: 'l4', label: 'LEVEL 4', min: 0, max: 1, def: 0.8, unit: '%' },
    { id: 'master', label: 'MASTER', min: 0, max: 1, def: 0.8, unit: '%' },
  ],
  controls: [
    { kind: 'in', jack: 'in1', x: 10, y: 24 },
    { kind: 'in', jack: 'in2', x: 10, y: 40 },
    { kind: 'in', jack: 'in3', x: 10, y: 56 },
    { kind: 'in', jack: 'in4', x: 10, y: 72 },
    { kind: 'knob', param: 'l1', x: 28.5, y: 24, label: '' },
    { kind: 'knob', param: 'l2', x: 28.5, y: 40, label: '' },
    { kind: 'knob', param: 'l3', x: 28.5, y: 56, label: '' },
    { kind: 'knob', param: 'l4', x: 28.5, y: 72, label: '' },
    { kind: 'knob', param: 'master', x: 20.3, y: 86 },
    { kind: 'out', jack: 'out', x: 10, y: 108 },
    { kind: 'out', jack: 'inv', x: 28.5, y: 108 },
  ],
}

export const mult: ModuleSpec = {
  type: 'mult',
  title: 'MULT',
  name: 'Buffered Multiple',
  tagline: 'Two 1→3 buffered mults; B input is normalled to A',
  category: 'Utilities',
  hp: 4,
  panel: BLACK,
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  outputs: [
    { id: 'a1', label: '' },
    { id: 'a2', label: '' },
    { id: 'a3', label: '' },
    { id: 'b1', label: '' },
    { id: 'b2', label: '' },
    { id: 'b3', label: '' },
  ],
  params: [],
  controls: [
    { kind: 'in', jack: 'a', x: 10.16, y: 22 },
    { kind: 'out', jack: 'a1', x: 10.16, y: 33 },
    { kind: 'out', jack: 'a2', x: 10.16, y: 43 },
    { kind: 'out', jack: 'a3', x: 10.16, y: 53 },
    { kind: 'text', text: 'A→B', x: 10.16, y: 63, size: 2 },
    { kind: 'in', jack: 'b', x: 10.16, y: 74 },
    { kind: 'out', jack: 'b1', x: 10.16, y: 85 },
    { kind: 'out', jack: 'b2', x: 10.16, y: 95 },
    { kind: 'out', jack: 'b3', x: 10.16, y: 105 },
  ],
}
