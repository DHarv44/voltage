import type { ModuleSpec } from '../types'
import { BLUE, GREEN } from './panels'

export const bbd: ModuleSpec = {
  type: 'bbd',
  title: 'BBD',
  name: 'Bucket-Brigade Delay',
  tagline: 'Analog BBD echo: darker as it gets longer, pitch-bends when you move time',
  category: 'Effects',
  hp: 10,
  panel: BLUE,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'time', label: 'TIME CV' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'wet', label: 'WET' },
  ],
  params: [
    { id: 'time', label: 'TIME', min: 0.02, max: 0.8, def: 0.3, curve: 'exp', unit: 's' },
    { id: 'fb', label: 'REPEATS', min: 0, max: 1.1, def: 0.45, unit: '%' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.4, unit: '%' },
    { id: 'mod', label: 'WARBLE', min: 0, max: 1, def: 0.15, unit: '%' },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'time', x: 25.4, y: 28, size: 'L' },
    { kind: 'knob', param: 'fb', x: 12, y: 52 },
    { kind: 'knob', param: 'mix', x: 38.8, y: 52 },
    { kind: 'knob', param: 'mod', x: 18, y: 68, size: 'S' },
    { kind: 'led', index: 0, x: 34, y: 68, color: '#7fc3ff' },
    { kind: 'in', jack: 'in', x: 14, y: 88 },
    { kind: 'in', jack: 'time', x: 36.8, y: 88 },
    { kind: 'out', jack: 'out', x: 16, y: 108 },
    { kind: 'out', jack: 'wet', x: 34.8, y: 108 },
  ],
}

export const spring: ModuleSpec = {
  type: 'spring',
  title: 'SPRING',
  name: 'Spring Reverb',
  tagline: 'Three-spring tank with dispersive "drip"; hit it hard for the crash',
  category: 'Effects',
  hp: 8,
  panel: GREEN,
  inputs: [{ id: 'in', label: 'IN' }],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'wet', label: 'WET' },
  ],
  params: [
    { id: 'decay', label: 'DECAY', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'tone', label: 'TONE', min: 800, max: 8000, def: 3500, curve: 'exp', unit: 'Hz' },
    { id: 'drive', label: 'DRIVE', min: 0.5, max: 4, def: 1, curve: 'exp', unit: 'x' },
    { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.35, unit: '%' },
  ],
  controls: [
    { kind: 'knob', param: 'decay', x: 11, y: 28 },
    { kind: 'knob', param: 'tone', x: 29.6, y: 28 },
    { kind: 'knob', param: 'drive', x: 11, y: 52 },
    { kind: 'knob', param: 'mix', x: 29.6, y: 52 },
    { kind: 'in', jack: 'in', x: 20.3, y: 82 },
    { kind: 'out', jack: 'out', x: 11, y: 107 },
    { kind: 'out', jack: 'wet', x: 29.6, y: 107 },
  ],
}
