import type { ModuleSpec } from '../types'
import { BLACK } from './panels'

export const vcf: ModuleSpec = {
  type: 'vcf',
  title: 'LADDER',
  name: 'Ladder Filter',
  tagline: '4-pole transistor-ladder lowpass, self-oscillates, saturates',
  category: 'Filters',
  hp: 10,
  panel: BLACK,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'cv', label: 'CV' },
    { id: 'voct', label: '1V/OCT' },
  ],
  outputs: [
    { id: 'lp4', label: '24dB' },
    { id: 'lp2', label: '12dB' },
  ],
  params: [
    { id: 'cutoff', label: 'CUTOFF', min: 20, max: 20000, def: 1000, curve: 'exp', unit: 'Hz' },
    { id: 'res', label: 'RESONANCE', min: 0, max: 1.1, def: 0.2, unit: '%' },
    { id: 'drive', label: 'DRIVE', min: 0.5, max: 4, def: 1, curve: 'exp', unit: 'x' },
    { id: 'cv', label: 'CV AMT', min: -1, max: 1, def: 0, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'cutoff', x: 25.4, y: 28, size: 'L' },
    { kind: 'knob', param: 'res', x: 12, y: 50 },
    { kind: 'knob', param: 'drive', x: 38.8, y: 50 },
    { kind: 'knob', param: 'cv', x: 25.4, y: 66, size: 'S' },
    { kind: 'in', jack: 'in', x: 10, y: 86 },
    { kind: 'in', jack: 'cv', x: 25.4, y: 86 },
    { kind: 'in', jack: 'voct', x: 40.8, y: 86 },
    { kind: 'out', jack: 'lp4', x: 16, y: 106 },
    { kind: 'out', jack: 'lp2', x: 34.8, y: 106 },
  ],
}
