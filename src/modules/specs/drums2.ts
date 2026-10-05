import type { ModuleSpec } from '../types'
import { DRUM } from './panels'

const LED = '#ff6a1a'

export const tom: ModuleSpec = {
  type: 'tom',
  title: 'TOM',
  name: 'Analog Tom / Conga',
  tagline: 'Tuned resonator drum: tom with pitch drop, or tight conga',
  category: 'Drums',
  hp: 6,
  panel: DRUM,
  inputs: [
    { id: 'trig', label: 'TRIG' },
    { id: 'acc', label: 'ACC' },
    { id: 'tune', label: 'TUNE' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'tune', label: 'TUNE', min: 60, max: 400, def: 120, curve: 'exp', unit: 'Hz' },
    { id: 'decay', label: 'DECAY', min: 0.05, max: 1.5, def: 0.4, curve: 'exp', unit: 's' },
    { id: 'sweep', label: 'SWEEP', min: 0, max: 1, def: 0.3, unit: '%' },
    { id: 'mode', label: 'MODE', min: 0, max: 1, def: 0, stepped: true, options: ['TOM', 'CONGA'] },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'tune', x: 15.24, y: 24 },
    { kind: 'knob', param: 'decay', x: 15.24, y: 42 },
    { kind: 'knob', param: 'sweep', x: 8.5, y: 59, size: 'S' },
    { kind: 'switch', param: 'mode', x: 22, y: 59 },
    { kind: 'led', index: 0, x: 15.24, y: 72, color: LED },
    { kind: 'in', jack: 'trig', x: 8.5, y: 86 },
    { kind: 'in', jack: 'acc', x: 22, y: 86 },
    { kind: 'in', jack: 'tune', x: 8.5, y: 106 },
    { kind: 'out', jack: 'out', x: 22, y: 106 },
  ],
}

export const perc: ModuleSpec = {
  type: 'perc',
  title: 'PERC',
  name: 'Rim & Cowbell',
  tagline: '808-style rimshot (bridged-T pair) and cowbell (two squares through a bandpass)',
  category: 'Drums',
  hp: 8,
  panel: DRUM,
  inputs: [
    { id: 'rim', label: 'RIM' },
    { id: 'bell', label: 'BELL' },
    { id: 'acc', label: 'ACC' },
  ],
  outputs: [
    { id: 'rim', label: 'RIM' },
    { id: 'bell', label: 'BELL' },
    { id: 'mix', label: 'MIX' },
  ],
  params: [
    { id: 'rtune', label: 'RIM TUNE', min: 0.5, max: 2, def: 1, curve: 'exp', unit: 'x' },
    { id: 'btune', label: 'BELL TUNE', min: 0.5, max: 2, def: 1, curve: 'exp', unit: 'x' },
    { id: 'bdecay', label: 'BELL DECAY', min: 0.05, max: 1, def: 0.25, curve: 'exp', unit: 's' },
  ],
  leds: 2,
  controls: [
    { kind: 'knob', param: 'rtune', x: 11, y: 26 },
    { kind: 'knob', param: 'btune', x: 29.6, y: 26 },
    { kind: 'knob', param: 'bdecay', x: 29.6, y: 46 },
    { kind: 'led', index: 0, x: 11, y: 46, color: LED },
    { kind: 'led', index: 1, x: 20.3, y: 58, color: LED },
    { kind: 'in', jack: 'rim', x: 8, y: 82 },
    { kind: 'in', jack: 'bell', x: 20.3, y: 82 },
    { kind: 'in', jack: 'acc', x: 32.6, y: 82 },
    { kind: 'out', jack: 'rim', x: 8, y: 106 },
    { kind: 'out', jack: 'bell', x: 20.3, y: 106 },
    { kind: 'out', jack: 'mix', x: 32.6, y: 106 },
  ],
}
