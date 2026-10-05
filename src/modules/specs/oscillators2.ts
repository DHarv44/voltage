import type { ModuleSpec } from '../types'
import { ALU, BLACK, RED } from './panels'

export const complexOsc: ModuleSpec = {
  type: 'complex',
  title: 'COMPLEX',
  name: 'Complex Oscillator',
  tagline: 'Buchla-style: modulator phase-modulates the principal, then a timbre wavefolder',
  category: 'Sources',
  hp: 16,
  panel: RED,
  inputs: [
    { id: 'voct', label: 'V/OCT' },
    { id: 'idx', label: 'INDEX' },
    { id: 'tmb', label: 'TIMBRE' },
    { id: 'mvoct', label: 'MOD V/O' },
  ],
  outputs: [
    { id: 'mod', label: 'MOD' },
    { id: 'sine', label: 'SINE' },
    { id: 'out', label: 'OUT' },
  ],
  params: [
    { id: 'mfreq', label: 'MOD FREQ', min: 0.1, max: 5000, def: 220, curve: 'exp', unit: 'Hz' },
    { id: 'pfreq', label: 'PRINCIPAL', min: -4, max: 4, def: 0, unit: 'oct' },
    { id: 'fine', label: 'FINE', min: -1, max: 1, def: 0, unit: 'st' },
    { id: 'index', label: 'FM INDEX', min: 0, max: 5, def: 0.5 },
    { id: 'timbre', label: 'TIMBRE', min: 0, max: 1, def: 0.2, unit: '%' },
    { id: 'sym', label: 'SYMMETRY', min: -1, max: 1, def: 0, unit: '%' },
    { id: 'track', label: 'MOD TRACK', min: 0, max: 1, def: 1, stepped: true, options: ['FREE', 'TRACK'] },
  ],
  controls: [
    { kind: 'text', text: 'MODULATOR', x: 14, y: 17, size: 1.8 },
    { kind: 'text', text: 'PRINCIPAL', x: 56, y: 17, size: 1.8 },
    { kind: 'knob', param: 'mfreq', x: 14, y: 29, size: 'L' },
    { kind: 'knob', param: 'pfreq', x: 46, y: 29, size: 'L' },
    { kind: 'knob', param: 'fine', x: 69, y: 29 },
    { kind: 'knob', param: 'index', x: 14, y: 55 },
    { kind: 'knob', param: 'timbre', x: 46, y: 55 },
    { kind: 'knob', param: 'sym', x: 69, y: 55, size: 'S' },
    { kind: 'switch', param: 'track', x: 30, y: 55 },
    { kind: 'in', jack: 'voct', x: 10, y: 84 },
    { kind: 'in', jack: 'idx', x: 27, y: 84 },
    { kind: 'in', jack: 'tmb', x: 44, y: 84 },
    { kind: 'in', jack: 'mvoct', x: 61, y: 84 },
    { kind: 'out', jack: 'mod', x: 14, y: 107 },
    { kind: 'out', jack: 'sine', x: 40.6, y: 107 },
    { kind: 'out', jack: 'out', x: 67, y: 107 },
  ],
}

export const WAVE_NAMES = ['SINE', 'TRI', 'SAW', 'SQUARE', 'PULSE', 'ORGAN', 'VOCAL', 'BRIGHT']

export const wave: ModuleSpec = {
  type: 'wave',
  title: 'WAVE',
  name: 'Wavetable Oscillator',
  tagline: 'Morphs through 8 band-limited waves; morph position under CV',
  category: 'Sources',
  hp: 10,
  panel: BLACK,
  inputs: [
    { id: 'voct', label: 'V/OCT' },
    { id: 'wcv', label: 'WAVE CV' },
    { id: 'fm', label: 'FM' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'coarse', label: 'FREQ', min: -4, max: 4, def: 0, unit: 'oct' },
    { id: 'fine', label: 'FINE', min: -1, max: 1, def: 0, unit: 'st' },
    { id: 'wave', label: 'WAVE', min: 0, max: 7, def: 0 },
    { id: 'wamt', label: 'CV AMT', min: -1, max: 1, def: 0.5, unit: '%' },
    { id: 'fmamt', label: 'FM', min: 0, max: 1, def: 0, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'coarse', x: 15, y: 27, size: 'L' },
    { kind: 'knob', param: 'fine', x: 38, y: 27 },
    { kind: 'knob', param: 'wave', x: 25.4, y: 52, size: 'L' },
    { kind: 'knob', param: 'wamt', x: 10, y: 66, size: 'S' },
    { kind: 'knob', param: 'fmamt', x: 40.8, y: 66, size: 'S' },
    { kind: 'in', jack: 'voct', x: 10, y: 86 },
    { kind: 'in', jack: 'wcv', x: 25.4, y: 86 },
    { kind: 'in', jack: 'fm', x: 40.8, y: 86 },
    { kind: 'out', jack: 'out', x: 25.4, y: 107 },
  ],
}

export const sub: ModuleSpec = {
  type: 'sub',
  title: 'SUB',
  name: 'Sub-Oscillator',
  tagline: 'Flip-flop dividers: square waves one and two octaves below any input',
  category: 'Sources',
  hp: 4,
  panel: ALU,
  inputs: [{ id: 'in', label: 'IN' }],
  outputs: [
    { id: 's1', label: '−1 OCT' },
    { id: 's2', label: '−2 OCT' },
    { id: 'mix', label: 'MIX' },
  ],
  params: [{ id: 'lvl', label: 'SUB LVL', min: 0, max: 1, def: 0.6, unit: '%' }],
  controls: [
    { kind: 'knob', param: 'lvl', x: 10.16, y: 26, size: 'S' },
    { kind: 'in', jack: 'in', x: 10.16, y: 47 },
    { kind: 'out', jack: 's1', x: 10.16, y: 70 },
    { kind: 'out', jack: 's2', x: 10.16, y: 89 },
    { kind: 'out', jack: 'mix', x: 10.16, y: 108 },
  ],
}
