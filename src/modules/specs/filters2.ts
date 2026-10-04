import type { ModuleSpec } from '../types'
import { GREEN, RED } from './panels'

export const svf: ModuleSpec = {
  type: 'svf',
  title: 'SVF',
  name: 'State-Variable Filter',
  tagline: 'Smooth 12 dB multimode (SEM-style): LP, BP, HP and notch at once',
  category: 'Filters',
  hp: 10,
  panel: GREEN,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'CV' },
    { id: 'voct', label: '1V/OCT' },
  ],
  outputs: [
    { id: 'lp', label: 'LP' },
    { id: 'bp', label: 'BP' },
    { id: 'hp', label: 'HP' },
    { id: 'notch', label: 'NOTCH' },
  ],
  params: [
    { id: 'cutoff', label: 'CUTOFF', min: 20, max: 20000, def: 800, curve: 'exp', unit: 'Hz' },
    { id: 'res', label: 'RESONANCE', min: 0, max: 1, def: 0.3, unit: '%' },
    { id: 'cv', label: 'CV AMT', min: -1, max: 1, def: 0, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'cutoff', x: 25.4, y: 28, size: 'L' },
    { kind: 'knob', param: 'res', x: 12, y: 52 },
    { kind: 'knob', param: 'cv', x: 38.8, y: 52, size: 'S' },
    { kind: 'in', jack: 'in', x: 10, y: 78 },
    { kind: 'in', jack: 'cv', x: 25.4, y: 78 },
    { kind: 'in', jack: 'voct', x: 40.8, y: 78 },
    { kind: 'out', jack: 'lp', x: 7.8, y: 106 },
    { kind: 'out', jack: 'bp', x: 19.4, y: 106 },
    { kind: 'out', jack: 'hp', x: 31.2, y: 106 },
    { kind: 'out', jack: 'notch', x: 42.9, y: 106 },
  ],
}

export const ms: ModuleSpec = {
  type: 'ms',
  title: 'MS-12',
  name: 'Screaming 12 dB Filter',
  tagline: 'Aggressive diode-clipped 12 dB lowpass/highpass (MS-20 style)',
  category: 'Filters',
  hp: 10,
  panel: RED,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'CV' },
    { id: 'voct', label: '1V/OCT' },
  ],
  outputs: [
    { id: 'lp', label: 'LP' },
    { id: 'hp', label: 'HP' },
  ],
  params: [
    { id: 'cutoff', label: 'CUTOFF', min: 20, max: 15000, def: 1200, curve: 'exp', unit: 'Hz' },
    { id: 'peak', label: 'PEAK', min: 0, max: 1.2, def: 0.3, unit: '%' },
    { id: 'cv', label: 'CV AMT', min: -1, max: 1, def: 0, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'cutoff', x: 25.4, y: 28, size: 'L' },
    { kind: 'knob', param: 'peak', x: 12, y: 52 },
    { kind: 'knob', param: 'cv', x: 38.8, y: 52, size: 'S' },
    { kind: 'in', jack: 'in', x: 10, y: 80 },
    { kind: 'in', jack: 'cv', x: 25.4, y: 80 },
    { kind: 'in', jack: 'voct', x: 40.8, y: 80 },
    { kind: 'out', jack: 'lp', x: 16, y: 106 },
    { kind: 'out', jack: 'hp', x: 34.8, y: 106 },
  ],
}
