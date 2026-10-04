import type { ModuleSpec } from '../types'
import { CREAM } from './panels'

export const lfo: ModuleSpec = {
  type: 'lfo',
  title: 'LFO',
  name: 'Low-Frequency Oscillator',
  tagline: 'Four ±5 V shapes, rate CV, reset, audio-range HI mode',
  category: 'Modulation',
  hp: 8,
  panel: CREAM,
  inputs: [
    { id: 'rate', label: 'RATE' },
    { id: 'reset', label: 'RESET' },
  ],
  outputs: [
    { id: 'sin', label: 'SIN' },
    { id: 'tri', label: 'TRI' },
    { id: 'saw', label: 'SAW' },
    { id: 'sqr', label: 'SQR' },
  ],
  params: [
    { id: 'rate', label: 'RATE', min: 0.02, max: 30, def: 1, curve: 'exp', unit: 'Hz' },
    { id: 'range', label: 'RANGE', min: 0, max: 1, def: 0, stepped: true, options: ['LO', 'HI'] },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'rate', x: 20.3, y: 27, size: 'L' },
    { kind: 'switch', param: 'range', x: 11, y: 52 },
    { kind: 'led', index: 0, x: 29.6, y: 52, bipolar: true },
    { kind: 'in', jack: 'rate', x: 11, y: 74 },
    { kind: 'in', jack: 'reset', x: 29.6, y: 74 },
    { kind: 'out', jack: 'sin', x: 11, y: 93 },
    { kind: 'out', jack: 'tri', x: 29.6, y: 93 },
    { kind: 'out', jack: 'saw', x: 11, y: 110 },
    { kind: 'out', jack: 'sqr', x: 29.6, y: 110 },
  ],
}
