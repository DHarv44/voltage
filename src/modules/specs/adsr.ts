import type { ModuleSpec } from '../types'
import { CREAM } from './panels'

export const adsr: ModuleSpec = {
  type: 'adsr',
  title: 'ADSR',
  name: 'Envelope',
  tagline: 'RC-curve envelope generator, 0–10 V, gate + retrigger',
  category: 'Envelopes & LFOs',
  hp: 8,
  panel: CREAM,
  inputs: [
    { id: 'gate', label: 'GATE' },
    { id: 'retrig', label: 'RETRIG' },
  ],
  outputs: [
    { id: 'env', label: 'ENV' },
    { id: 'inv', label: 'INV' },
  ],
  params: [
    { id: 'a', label: 'ATTACK', min: 0.001, max: 10, def: 0.01, curve: 'exp', unit: 's' },
    { id: 'd', label: 'DECAY', min: 0.001, max: 10, def: 0.3, curve: 'exp', unit: 's' },
    { id: 's', label: 'SUSTAIN', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'r', label: 'RELEASE', min: 0.001, max: 10, def: 0.5, curve: 'exp', unit: 's' },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'a', x: 11, y: 28 },
    { kind: 'knob', param: 'd', x: 29.6, y: 28 },
    { kind: 'knob', param: 's', x: 11, y: 50 },
    { kind: 'knob', param: 'r', x: 29.6, y: 50 },
    { kind: 'led', index: 0, x: 20.3, y: 66, color: '#ff3b2f' },
    { kind: 'in', jack: 'gate', x: 11, y: 86 },
    { kind: 'in', jack: 'retrig', x: 29.6, y: 86 },
    { kind: 'out', jack: 'env', x: 11, y: 106 },
    { kind: 'out', jack: 'inv', x: 29.6, y: 106 },
  ],
}
