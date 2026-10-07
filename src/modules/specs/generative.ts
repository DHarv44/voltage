import type { Control, ModuleSpec } from '../types'
import { BLACK, SAND } from './panels'

export const euclid: ModuleSpec = {
  type: 'euclid',
  title: 'EUCLID',
  name: 'Euclidean Rhythms',
  tagline: 'Two channels spreading N hits as evenly as possible over M steps, with rotation',
  category: 'Sequencers',
  hp: 8,
  panel: BLACK,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  params: [
    { id: 'stepsA', label: 'STEPS A', min: 1, max: 16, def: 16, stepped: true },
    { id: 'fillsA', label: 'HITS A', min: 0, max: 16, def: 5, stepped: true },
    { id: 'rotA', label: 'ROT A', min: 0, max: 15, def: 0, stepped: true },
    { id: 'stepsB', label: 'STEPS B', min: 1, max: 16, def: 12, stepped: true },
    { id: 'fillsB', label: 'HITS B', min: 0, max: 16, def: 7, stepped: true },
    { id: 'rotB', label: 'ROT B', min: 0, max: 15, def: 0, stepped: true },
  ],
  leds: 2,
  controls: [
    ...(['A', 'B'] as const).flatMap((ch, k): Control[] => {
      const x = k ? 29.6 : 11
      return [
        { kind: 'text', text: ch, x, y: 18, size: 2.6 },
        { kind: 'knob', param: `steps${ch}`, x, y: 28 },
        { kind: 'knob', param: `fills${ch}`, x, y: 46 },
        { kind: 'knob', param: `rot${ch}`, x, y: 62, size: 'S' },
        { kind: 'led', index: k, x, y: 73, color: '#ff3b2f' },
      ]
    }),
    { kind: 'in', jack: 'clk', x: 11, y: 88 },
    { kind: 'in', jack: 'rst', x: 29.6, y: 88 },
    { kind: 'out', jack: 'a', x: 11, y: 108 },
    { kind: 'out', jack: 'b', x: 29.6, y: 108 },
  ],
}

export const turing: ModuleSpec = {
  type: 'turing',
  title: 'TURING',
  name: 'Turing Machine',
  tagline: 'Looping random shift register: lock a melody, or let it slowly mutate',
  category: 'Sequencers',
  hp: 8,
  panel: SAND,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'chg', label: 'CHANGE' },
  ],
  outputs: [
    { id: 'cv', label: 'CV' },
    { id: 'gate', label: 'GATE' },
    { id: 'noise', label: 'BIT' },
  ],
  params: [
    { id: 'change', label: 'CHANGE', min: 0, max: 1, def: 0.15, unit: '%' },
    { id: 'len', label: 'LENGTH', min: 2, max: 16, def: 8, stepped: true },
    { id: 'range', label: 'RANGE', min: 0.1, max: 5, def: 2, unit: 'V' },
  ],
  leds: 8,
  controls: [
    { kind: 'knob', param: 'change', x: 20.3, y: 27, size: 'L' },
    { kind: 'knob', param: 'len', x: 11, y: 50 },
    { kind: 'knob', param: 'range', x: 29.6, y: 50 },
    ...Array.from({ length: 8 }, (_, k): Control => ({ kind: 'led', index: k, x: 6.3 + k * 4, y: 64, color: '#ff3b2f' })),
    { kind: 'in', jack: 'clk', x: 11, y: 84 },
    { kind: 'in', jack: 'chg', x: 29.6, y: 84 },
    { kind: 'out', jack: 'cv', x: 8, y: 107 },
    { kind: 'out', jack: 'gate', x: 20.3, y: 107 },
    { kind: 'out', jack: 'noise', x: 32.6, y: 107 },
  ],
}
