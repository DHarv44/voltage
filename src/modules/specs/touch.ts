import type { Control, ModuleSpec } from '../types'
import { CREAM } from './panels'

const PX = [9.5, 23.5, 37.5, 51.5]

export const touch: ModuleSpec = {
  type: 'touch',
  title: 'TOUCH',
  name: 'Touch Plates',
  tagline: 'Buchla-style plates: drag for position, press higher for more pressure',
  category: 'Controllers',
  hp: 12,
  panel: CREAM,
  inputs: [],
  outputs: [
    ...PX.map((_, i) => ({ id: `g${i + 1}`, label: `G${i + 1}` })),
    { id: 'pres', label: 'PRES' },
    { id: 'pos', label: 'POS' },
    { id: 'pitch', label: 'PITCH' },
    { id: 'gate', label: 'GATE' },
  ],
  params: [
    { id: 'interval', label: 'INTERVAL', min: 0, max: 12, def: 2, stepped: true },
    { id: 'slew', label: 'SLEW', min: 0.001, max: 0.5, def: 0.02, curve: 'exp', unit: 's' },
  ],
  leds: 4,
  controls: [
    ...PX.map((x, i): Control => ({ kind: 'plate', index: i, x: x - 6, y: 18, w: 12, h: 36, label: String(i + 1), led: i })),
    ...PX.map((x, i): Control => ({ kind: 'out', jack: `g${i + 1}`, x, y: 72 })),
    { kind: 'out', jack: 'pres', x: PX[0], y: 92 },
    { kind: 'out', jack: 'pos', x: PX[1], y: 92 },
    { kind: 'out', jack: 'pitch', x: PX[2], y: 92 },
    { kind: 'out', jack: 'gate', x: PX[3], y: 92 },
    { kind: 'knob', param: 'interval', x: 16, y: 108, size: 'S' },
    { kind: 'knob', param: 'slew', x: 45, y: 108, size: 'S' },
  ],
}
