import type { ModuleSpec } from '../types'
import { ALU, BLACK, CREAM, RED } from './panels'

export const fold: ModuleSpec = {
  type: 'fold',
  title: 'FOLD',
  name: 'Wavefolder',
  tagline: 'West-coast sine folder with symmetry and fold CV, anti-aliased',
  category: 'Shapers',
  hp: 8,
  panel: RED,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'CV' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'fold', label: 'FOLDS', min: 0.5, max: 10, def: 1.5, curve: 'exp', unit: 'x' },
    { id: 'bias', label: 'SYMMETRY', min: -1, max: 1, def: 0, unit: '%' },
    { id: 'cv', label: 'CV AMT', min: -1, max: 1, def: 0, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'fold', x: 20.3, y: 28, size: 'L' },
    { kind: 'knob', param: 'bias', x: 11, y: 54 },
    { kind: 'knob', param: 'cv', x: 29.6, y: 54, size: 'S' },
    { kind: 'in', jack: 'in', x: 11, y: 86 },
    { kind: 'in', jack: 'cv', x: 29.6, y: 86 },
    { kind: 'out', jack: 'out', x: 20.3, y: 107 },
  ],
}

export const sh: ModuleSpec = {
  type: 'sh',
  title: 'S&H',
  name: 'Sample & Hold',
  tagline: 'Holds a voltage on each trigger; input normalled to noise; slow droop',
  category: 'CV Tools',
  hp: 6,
  panel: BLACK,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'trig', label: 'TRIG' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [],
  leds: 1,
  controls: [
    { kind: 'in', jack: 'in', x: 15.24, y: 30 },
    { kind: 'text', text: 'IN ← NOISE', x: 15.24, y: 38.5, size: 1.8 },
    { kind: 'in', jack: 'trig', x: 15.24, y: 56 },
    { kind: 'led', index: 0, x: 15.24, y: 70, bipolar: true },
    { kind: 'out', jack: 'out', x: 15.24, y: 100 },
  ],
}

export const slew: ModuleSpec = {
  type: 'slew',
  title: 'SLEW',
  name: 'Slew Limiter',
  tagline: 'Independent rise/fall lag: portamento, envelope follower, smoothing',
  category: 'CV Tools',
  hp: 6,
  panel: CREAM,
  inputs: [{ id: 'in', label: 'IN' }],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'rise', label: 'RISE', min: 0.001, max: 10, def: 0.1, curve: 'exp', unit: 's' },
    { id: 'fall', label: 'FALL', min: 0.001, max: 10, def: 0.1, curve: 'exp', unit: 's' },
    { id: 'shape', label: 'SHAPE', min: 0, max: 1, def: 0, stepped: true, options: ['LIN', 'EXP'] },
  ],
  controls: [
    { kind: 'knob', param: 'rise', x: 15.24, y: 26 },
    { kind: 'knob', param: 'fall', x: 15.24, y: 46 },
    { kind: 'switch', param: 'shape', x: 15.24, y: 67 },
    { kind: 'in', jack: 'in', x: 15.24, y: 87 },
    { kind: 'out', jack: 'out', x: 15.24, y: 107 },
  ],
}

export const QUANT_SCALES = ['CHROM', 'MAJOR', 'MINOR', 'DORIAN', 'PENTA', 'BLUES']

export const quant: ModuleSpec = {
  type: 'quant',
  title: 'QUANT',
  name: 'Quantizer',
  tagline: 'Snaps 1V/oct CV to a scale; optional clocked sampling',
  category: 'CV Tools',
  hp: 8,
  panel: ALU,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'clk', label: 'CLK' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'chg', label: 'CHG' },
  ],
  params: [
    { id: 'scale', label: 'SCALE', min: 0, max: QUANT_SCALES.length - 1, def: 1, stepped: true, options: QUANT_SCALES },
    { id: 'trans', label: 'TRANSPOSE', min: -12, max: 12, def: 0, stepped: true },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'scale', x: 11, y: 28 },
    { kind: 'knob', param: 'trans', x: 29.6, y: 28 },
    { kind: 'led', index: 0, x: 20.3, y: 46, color: '#3bff6b' },
    { kind: 'in', jack: 'in', x: 11, y: 70 },
    { kind: 'in', jack: 'clk', x: 29.6, y: 70 },
    { kind: 'out', jack: 'out', x: 11, y: 100 },
    { kind: 'out', jack: 'chg', x: 29.6, y: 100 },
  ],
}

export const atten: ModuleSpec = {
  type: 'atten',
  title: 'ATTN',
  name: 'Attenuverter',
  tagline: 'Two attenuverters; empty inputs read +5 V, so knobs become offsets',
  category: 'CV Tools',
  hp: 6,
  panel: ALU,
  inputs: [
    { id: 'a', label: 'IN' },
    { id: 'b', label: 'IN' },
  ],
  outputs: [
    { id: 'a', label: 'OUT' },
    { id: 'b', label: 'OUT' },
  ],
  params: [
    { id: 'a', label: 'A', min: -1, max: 1, def: 0, unit: '%' },
    { id: 'b', label: 'B', min: -1, max: 1, def: 0, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'a', x: 15.24, y: 26 },
    { kind: 'in', jack: 'a', x: 8.5, y: 48 },
    { kind: 'out', jack: 'a', x: 22, y: 48 },
    { kind: 'knob', param: 'b', x: 15.24, y: 68 },
    { kind: 'in', jack: 'b', x: 8.5, y: 90 },
    { kind: 'out', jack: 'b', x: 22, y: 90 },
    { kind: 'text', text: 'IN ← +5V', x: 15.24, y: 104, size: 1.8 },
  ],
}
