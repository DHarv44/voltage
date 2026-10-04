import type { Control, ModuleSpec } from '../types'
import { ALU, BLACK, BLUE, CREAM } from './panels'

const P = true

export const polycv: ModuleSpec = {
  type: 'polycv',
  title: 'POLY·CV',
  name: 'Polyphonic MIDI to CV',
  tagline: 'Up to 8 voices on poly cables: pitch, gate, velocity; voice stealing',
  category: 'Polyphonic',
  hp: 8,
  panel: BLUE,
  inputs: [],
  outputs: [
    { id: 'pitch', label: '1V/OCT', poly: P },
    { id: 'gate', label: 'GATE', poly: P },
    { id: 'vel', label: 'VEL', poly: P },
    { id: 'mod', label: 'MOD' },
    { id: 'bend', label: 'BEND' },
  ],
  params: [{ id: 'voices', label: 'VOICES', min: 1, max: 8, def: 4, stepped: true }],
  leds: 8,
  controls: [
    { kind: 'knob', param: 'voices', x: 20.3, y: 27 },
    ...Array.from({ length: 8 }, (_, k): Control => ({ kind: 'led', index: k, x: 6.3 + k * 4, y: 43, color: '#3bff6b' })),
    { kind: 'out', jack: 'pitch', x: 11, y: 64 },
    { kind: 'out', jack: 'gate', x: 29.6, y: 64 },
    { kind: 'out', jack: 'vel', x: 11, y: 86 },
    { kind: 'out', jack: 'mod', x: 29.6, y: 86 },
    { kind: 'out', jack: 'bend', x: 20.3, y: 108 },
  ],
}

export const pvco: ModuleSpec = {
  type: 'pvco',
  title: 'P-VCO',
  name: 'Polyphonic Oscillator',
  tagline: 'One analog-style VCO per voice, each with its own drift and tolerance',
  category: 'Polyphonic',
  hp: 10,
  panel: ALU,
  inputs: [
    { id: 'voct', label: '1V/OCT' },
    { id: 'fm', label: 'FM' },
  ],
  outputs: [
    { id: 'saw', label: 'SAW', poly: P },
    { id: 'sqr', label: 'PULSE', poly: P },
    { id: 'sin', label: 'SIN', poly: P },
  ],
  params: [
    { id: 'coarse', label: 'FREQ', min: -4, max: 4, def: 0, unit: 'oct' },
    { id: 'fine', label: 'FINE', min: -1, max: 1, def: 0, unit: 'st' },
    { id: 'pw', label: 'WIDTH', min: 0.05, max: 0.95, def: 0.5, unit: '%' },
    { id: 'fm', label: 'FM', min: 0, max: 1, def: 0, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'coarse', x: 15, y: 27, size: 'L' },
    { kind: 'knob', param: 'fine', x: 38, y: 27 },
    { kind: 'knob', param: 'pw', x: 13, y: 52 },
    { kind: 'knob', param: 'fm', x: 38, y: 52 },
    { kind: 'in', jack: 'voct', x: 13, y: 80 },
    { kind: 'in', jack: 'fm', x: 38, y: 80 },
    { kind: 'out', jack: 'saw', x: 10, y: 106 },
    { kind: 'out', jack: 'sqr', x: 25.4, y: 106 },
    { kind: 'out', jack: 'sin', x: 40.8, y: 106 },
  ],
}

export const pvcf: ModuleSpec = {
  type: 'pvcf',
  title: 'P-LADDER',
  name: 'Polyphonic Ladder Filter',
  tagline: 'Transistor ladder per voice; CV and 1V/OCT can be poly or mono',
  category: 'Polyphonic',
  hp: 10,
  panel: BLACK,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'CV' },
    { id: 'voct', label: '1V/OCT' },
  ],
  outputs: [{ id: 'lp', label: '24dB', poly: P }],
  params: [
    { id: 'cutoff', label: 'CUTOFF', min: 20, max: 20000, def: 1200, curve: 'exp', unit: 'Hz' },
    { id: 'res', label: 'RESONANCE', min: 0, max: 1.1, def: 0.25, unit: '%' },
    { id: 'drive', label: 'DRIVE', min: 0.5, max: 4, def: 1, curve: 'exp', unit: 'x' },
    { id: 'cv', label: 'CV AMT', min: -1, max: 1, def: 0.4, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'cutoff', x: 25.4, y: 28, size: 'L' },
    { kind: 'knob', param: 'res', x: 12, y: 50 },
    { kind: 'knob', param: 'drive', x: 38.8, y: 50 },
    { kind: 'knob', param: 'cv', x: 25.4, y: 66, size: 'S' },
    { kind: 'in', jack: 'in', x: 10, y: 86 },
    { kind: 'in', jack: 'cv', x: 25.4, y: 86 },
    { kind: 'in', jack: 'voct', x: 40.8, y: 86 },
    { kind: 'out', jack: 'lp', x: 25.4, y: 107 },
  ],
}

export const padsr: ModuleSpec = {
  type: 'padsr',
  title: 'P-ADSR',
  name: 'Polyphonic Envelope',
  tagline: 'One analog ADSR per voice, driven by a poly gate',
  category: 'Polyphonic',
  hp: 8,
  panel: CREAM,
  inputs: [{ id: 'gate', label: 'GATE' }],
  outputs: [{ id: 'env', label: 'ENV', poly: P }],
  params: [
    { id: 'a', label: 'ATTACK', min: 0.001, max: 10, def: 0.02, curve: 'exp', unit: 's' },
    { id: 'd', label: 'DECAY', min: 0.001, max: 10, def: 0.4, curve: 'exp', unit: 's' },
    { id: 's', label: 'SUSTAIN', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'r', label: 'RELEASE', min: 0.001, max: 10, def: 0.6, curve: 'exp', unit: 's' },
  ],
  controls: [
    { kind: 'knob', param: 'a', x: 11, y: 28 },
    { kind: 'knob', param: 'd', x: 29.6, y: 28 },
    { kind: 'knob', param: 's', x: 11, y: 50 },
    { kind: 'knob', param: 'r', x: 29.6, y: 50 },
    { kind: 'in', jack: 'gate', x: 20.3, y: 82 },
    { kind: 'out', jack: 'env', x: 20.3, y: 106 },
  ],
}

export const pvca: ModuleSpec = {
  type: 'pvca',
  title: 'P-VCA',
  name: 'Polyphonic VCA',
  tagline: 'One VCA per voice; CV poly or mono',
  category: 'Polyphonic',
  hp: 6,
  panel: ALU,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'CV' },
  ],
  outputs: [{ id: 'out', label: 'OUT', poly: P }],
  params: [
    { id: 'gain', label: 'LEVEL', min: 0, max: 1, def: 0, unit: '%' },
    { id: 'cv', label: 'CV', min: 0, max: 1, def: 1, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'gain', x: 15.24, y: 28 },
    { kind: 'knob', param: 'cv', x: 15.24, y: 48, size: 'S' },
    { kind: 'in', jack: 'in', x: 8.5, y: 80 },
    { kind: 'in', jack: 'cv', x: 22, y: 80 },
    { kind: 'out', jack: 'out', x: 15.24, y: 106 },
  ],
}

export const polymix: ModuleSpec = {
  type: 'polymix',
  title: 'POLY MIX',
  name: 'Poly Sum / Split / Merge',
  tagline: 'Sum a poly cable to mono, split voices 1–4 out, or merge 4 mono signals into poly',
  category: 'Polyphonic',
  hp: 10,
  panel: BLACK,
  inputs: [{ id: 'in', label: 'POLY IN' }, ...[1, 2, 3, 4].map((n) => ({ id: `m${n}`, label: `M${n}` }))],
  outputs: [
    { id: 'sum', label: 'SUM' },
    ...[1, 2, 3, 4].map((n) => ({ id: `c${n}`, label: `V${n}` })),
    { id: 'merged', label: 'MERGED', poly: P },
  ],
  params: [{ id: 'level', label: 'SUM LVL', min: 0, max: 1.5, def: 0.6, unit: '%' }],
  controls: [
    { kind: 'in', jack: 'in', x: 13, y: 26 },
    { kind: 'knob', param: 'level', x: 38, y: 26, size: 'S' },
    { kind: 'out', jack: 'sum', x: 25.4, y: 45 },
    ...[1, 2, 3, 4].map((n, k): Control => ({ kind: 'out', jack: `c${n}`, x: 8 + k * 11.6, y: 66 })),
    ...[1, 2, 3, 4].map((n, k): Control => ({ kind: 'in', jack: `m${n}`, x: 8 + k * 11.6, y: 86 })),
    { kind: 'out', jack: 'merged', x: 25.4, y: 108 },
  ],
}
