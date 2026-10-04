import type { ModuleSpec } from '../types'
import { BLACK, BLUE, CREAM, GREEN } from './panels'

export const tape: ModuleSpec = {
  type: 'tape',
  title: 'TAPE',
  name: 'Tape Echo',
  tagline: 'Tape delay: saturation, head bump, HF loss and hiss with AGE, wow/flutter, varispeed',
  category: 'Effects',
  hp: 10,
  panel: CREAM,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'time', label: 'TIME CV' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'wet', label: 'WET' },
  ],
  params: [
    { id: 'time', label: 'TIME', min: 0.05, max: 1.5, def: 0.35, curve: 'exp', unit: 's' },
    { id: 'fb', label: 'REPEATS', min: 0, max: 1.1, def: 0.45, unit: '%' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.35, unit: '%' },
    { id: 'wow', label: 'WOW', min: 0, max: 1, def: 0.25, unit: '%' },
    { id: 'age', label: 'AGE', min: 0, max: 1, def: 0.3, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'time', x: 25.4, y: 27, size: 'L' },
    { kind: 'knob', param: 'fb', x: 12, y: 50 },
    { kind: 'knob', param: 'mix', x: 38.8, y: 50 },
    { kind: 'knob', param: 'wow', x: 12, y: 68, size: 'S' },
    { kind: 'knob', param: 'age', x: 38.8, y: 68, size: 'S' },
    { kind: 'in', jack: 'in', x: 14, y: 88 },
    { kind: 'in', jack: 'time', x: 36.8, y: 88 },
    { kind: 'out', jack: 'out', x: 16, y: 108 },
    { kind: 'out', jack: 'wet', x: 34.8, y: 108 },
  ],
}

export const phaser: ModuleSpec = {
  type: 'phaser',
  title: 'PHASER',
  name: 'Phaser',
  tagline: 'Six-stage allpass phaser with LFO sweep, feedback and external CV',
  category: 'Effects',
  hp: 8,
  panel: BLUE,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'SWEEP' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'rate', label: 'RATE', min: 0.05, max: 8, def: 0.4, curve: 'exp', unit: 'Hz' },
    { id: 'depth', label: 'DEPTH', min: 0, max: 1, def: 0.7, unit: '%' },
    { id: 'center', label: 'CENTER', min: 150, max: 3000, def: 700, curve: 'exp', unit: 'Hz' },
    { id: 'fb', label: 'FEEDBACK', min: 0, max: 0.9, def: 0.4, unit: '%' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.5, unit: '%' },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'rate', x: 11, y: 26 },
    { kind: 'knob', param: 'depth', x: 29.6, y: 26 },
    { kind: 'knob', param: 'center', x: 11, y: 47 },
    { kind: 'knob', param: 'fb', x: 29.6, y: 47 },
    { kind: 'knob', param: 'mix', x: 11, y: 66, size: 'S' },
    { kind: 'led', index: 0, x: 29.6, y: 66, bipolar: true },
    { kind: 'in', jack: 'in', x: 11, y: 86 },
    { kind: 'in', jack: 'cv', x: 29.6, y: 86 },
    { kind: 'out', jack: 'out', x: 20.3, y: 108 },
  ],
}

export const ensemble: ModuleSpec = {
  type: 'ensemble',
  title: 'ENSEMBLE',
  name: 'String Ensemble Chorus',
  tagline: 'Solina-style: three modulated BBD lines, stereo out',
  category: 'Effects',
  hp: 8,
  panel: GREEN,
  inputs: [{ id: 'in', label: 'IN' }],
  outputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  params: [
    { id: 'rate', label: 'RATE', min: 0.2, max: 3, def: 1, curve: 'exp', unit: 'x' },
    { id: 'depth', label: 'DEPTH', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.6, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'rate', x: 11, y: 28 },
    { kind: 'knob', param: 'depth', x: 29.6, y: 28 },
    { kind: 'knob', param: 'mix', x: 20.3, y: 50 },
    { kind: 'in', jack: 'in', x: 20.3, y: 78 },
    { kind: 'out', jack: 'l', x: 11, y: 106 },
    { kind: 'out', jack: 'r', x: 29.6, y: 106 },
  ],
}

export const plate: ModuleSpec = {
  type: 'plate',
  title: 'PLATE',
  name: 'Plate Reverb',
  tagline: 'Dattorro plate: diffused, modulated tank with predelay, decay and damping',
  category: 'Effects',
  hp: 10,
  panel: BLACK,
  inputs: [{ id: 'in', label: 'IN' }],
  outputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  params: [
    { id: 'decay', label: 'DECAY', min: 0, max: 0.97, def: 0.6, unit: '%' },
    { id: 'damp', label: 'DAMPING', min: 0, max: 1, def: 0.3, unit: '%' },
    { id: 'pre', label: 'PREDELAY', min: 0, max: 0.2, def: 0.02, unit: 's' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.35, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'decay', x: 25.4, y: 28, size: 'L' },
    { kind: 'knob', param: 'damp', x: 12, y: 52 },
    { kind: 'knob', param: 'pre', x: 38.8, y: 52 },
    { kind: 'knob', param: 'mix', x: 25.4, y: 68, size: 'S' },
    { kind: 'in', jack: 'in', x: 25.4, y: 87 },
    { kind: 'out', jack: 'l', x: 16, y: 108 },
    { kind: 'out', jack: 'r', x: 34.8, y: 108 },
  ],
}
