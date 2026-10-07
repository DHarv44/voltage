import type { ModuleSpec } from '../types'
import { ALU } from './panels'

export const vco: ModuleSpec = {
  type: 'vco',
  title: 'VCO',
  name: 'Oscillator',
  tagline: 'Analog-style VCO with thermal drift, hard sync, PWM',
  category: 'Oscillators',
  hp: 12,
  panel: ALU,
  inputs: [
    { id: 'voct', label: '1V/OCT' },
    { id: 'fm', label: 'FM' },
    { id: 'pwm', label: 'PWM' },
    { id: 'sync', label: 'SYNC' },
  ],
  outputs: [
    { id: 'sin', label: 'SIN' },
    { id: 'tri', label: 'TRI' },
    { id: 'saw', label: 'SAW' },
    { id: 'sqr', label: 'PULSE' },
  ],
  params: [
    { id: 'coarse', label: 'FREQ', min: -4, max: 4, def: 0, unit: 'oct' },
    { id: 'fine', label: 'FINE', min: -1, max: 1, def: 0, unit: 'st' },
    { id: 'fm', label: 'FM', min: 0, max: 1, def: 0, unit: '%' },
    { id: 'pw', label: 'WIDTH', min: 0.05, max: 0.95, def: 0.5, unit: '%' },
    { id: 'pwm', label: 'PWM', min: 0, max: 1, def: 0, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'coarse', x: 19, y: 28, size: 'L' },
    { kind: 'knob', param: 'fine', x: 44, y: 28, size: 'M' },
    { kind: 'knob', param: 'fm', x: 11, y: 52 },
    { kind: 'knob', param: 'pw', x: 30.5, y: 52 },
    { kind: 'knob', param: 'pwm', x: 50, y: 52 },
    { kind: 'in', jack: 'voct', x: 9, y: 80 },
    { kind: 'in', jack: 'fm', x: 23, y: 80 },
    { kind: 'in', jack: 'pwm', x: 38, y: 80 },
    { kind: 'in', jack: 'sync', x: 52, y: 80 },
    { kind: 'out', jack: 'sin', x: 9, y: 104 },
    { kind: 'out', jack: 'tri', x: 23, y: 104 },
    { kind: 'out', jack: 'saw', x: 38, y: 104 },
    { kind: 'out', jack: 'sqr', x: 52, y: 104 },
  ],
}
