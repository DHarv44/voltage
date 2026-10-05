import type { ModuleSpec } from '../types'
import { DRUM } from './panels'

const LED = '#ff6a1a'

export const kick: ModuleSpec = {
  type: 'kick',
  title: 'KICK',
  name: 'Analog Kick',
  tagline: 'Pinged bridged-T resonator with pitch sweep (808-style)',
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
    { id: 'tune', label: 'TUNE', min: 30, max: 120, def: 52, curve: 'exp', unit: 'Hz' },
    { id: 'decay', label: 'DECAY', min: 0.05, max: 2, def: 0.5, curve: 'exp', unit: 's' },
    { id: 'punch', label: 'PUNCH', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'drive', label: 'DRIVE', min: 0, max: 1, def: 0.2, unit: '%' },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'tune', x: 15.24, y: 24 },
    { kind: 'knob', param: 'decay', x: 15.24, y: 42 },
    { kind: 'knob', param: 'punch', x: 8.5, y: 59, size: 'S' },
    { kind: 'knob', param: 'drive', x: 22, y: 59, size: 'S' },
    { kind: 'led', index: 0, x: 15.24, y: 70, color: LED },
    { kind: 'in', jack: 'trig', x: 8.5, y: 85 },
    { kind: 'in', jack: 'acc', x: 22, y: 85 },
    { kind: 'in', jack: 'tune', x: 8.5, y: 105 },
    { kind: 'out', jack: 'out', x: 22, y: 105 },
  ],
}

export const snare: ModuleSpec = {
  type: 'snare',
  title: 'SNARE',
  name: 'Analog Snare',
  tagline: 'Two tuned heads plus snappy noise wires',
  category: 'Drums',
  hp: 6,
  panel: DRUM,
  inputs: [
    { id: 'trig', label: 'TRIG' },
    { id: 'acc', label: 'ACC' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'tune', label: 'TUNE', min: 120, max: 400, def: 190, curve: 'exp', unit: 'Hz' },
    { id: 'decay', label: 'DECAY', min: 0.05, max: 0.6, def: 0.18, curve: 'exp', unit: 's' },
    { id: 'tone', label: 'TONE', min: 0, max: 1, def: 0.4, unit: '%' },
    { id: 'snappy', label: 'SNAPPY', min: 0, max: 1, def: 0.6, unit: '%' },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'tune', x: 15.24, y: 24 },
    { kind: 'knob', param: 'decay', x: 15.24, y: 42 },
    { kind: 'knob', param: 'tone', x: 8.5, y: 59, size: 'S' },
    { kind: 'knob', param: 'snappy', x: 22, y: 59, size: 'S' },
    { kind: 'led', index: 0, x: 15.24, y: 70, color: LED },
    { kind: 'in', jack: 'trig', x: 8.5, y: 85 },
    { kind: 'in', jack: 'acc', x: 22, y: 85 },
    { kind: 'out', jack: 'out', x: 15.24, y: 105 },
  ],
}

export const clap: ModuleSpec = {
  type: 'clap',
  title: 'CLAP',
  name: 'Analog Clap',
  tagline: 'Multi-burst noise clap with reverberant tail',
  category: 'Drums',
  hp: 6,
  panel: DRUM,
  inputs: [
    { id: 'trig', label: 'TRIG' },
    { id: 'acc', label: 'ACC' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  params: [
    { id: 'tone', label: 'TONE', min: 600, max: 3000, def: 1100, curve: 'exp', unit: 'Hz' },
    { id: 'decay', label: 'DECAY', min: 0.05, max: 1, def: 0.3, curve: 'exp', unit: 's' },
    { id: 'spread', label: 'SPREAD', min: 0.004, max: 0.02, def: 0.009, curve: 'exp', unit: 's' },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'tone', x: 15.24, y: 24 },
    { kind: 'knob', param: 'decay', x: 15.24, y: 42 },
    { kind: 'knob', param: 'spread', x: 15.24, y: 59, size: 'S' },
    { kind: 'led', index: 0, x: 15.24, y: 70, color: LED },
    { kind: 'in', jack: 'trig', x: 8.5, y: 85 },
    { kind: 'in', jack: 'acc', x: 22, y: 85 },
    { kind: 'out', jack: 'out', x: 15.24, y: 105 },
  ],
}

export const hats: ModuleSpec = {
  type: 'hats',
  title: 'HATS',
  name: 'Analog Hi-Hats',
  tagline: 'Six-square 808 metal, closed + open; closed chokes open',
  category: 'Drums',
  hp: 8,
  panel: DRUM,
  inputs: [
    { id: 'ch', label: 'CH' },
    { id: 'oh', label: 'OH' },
    { id: 'acc', label: 'ACC' },
  ],
  outputs: [
    { id: 'ch', label: 'CH' },
    { id: 'oh', label: 'OH' },
    { id: 'mix', label: 'MIX' },
  ],
  params: [
    { id: 'tune', label: 'METAL', min: 0.5, max: 2, def: 1, curve: 'exp', unit: 'x' },
    { id: 'tone', label: 'TONE', min: 4000, max: 12000, def: 7500, curve: 'exp', unit: 'Hz' },
    { id: 'chd', label: 'CH DECAY', min: 0.01, max: 0.25, def: 0.05, curve: 'exp', unit: 's' },
    { id: 'ohd', label: 'OH DECAY', min: 0.1, max: 2, def: 0.5, curve: 'exp', unit: 's' },
  ],
  leds: 2,
  controls: [
    { kind: 'knob', param: 'tune', x: 11, y: 26 },
    { kind: 'knob', param: 'tone', x: 29.6, y: 26 },
    { kind: 'knob', param: 'chd', x: 11, y: 48 },
    { kind: 'knob', param: 'ohd', x: 29.6, y: 48 },
    { kind: 'led', index: 0, x: 11, y: 63, color: LED },
    { kind: 'led', index: 1, x: 29.6, y: 63, color: LED },
    { kind: 'in', jack: 'ch', x: 8, y: 82 },
    { kind: 'in', jack: 'oh', x: 20.3, y: 82 },
    { kind: 'in', jack: 'acc', x: 32.6, y: 82 },
    { kind: 'out', jack: 'ch', x: 8, y: 106 },
    { kind: 'out', jack: 'oh', x: 20.3, y: 106 },
    { kind: 'out', jack: 'mix', x: 32.6, y: 106 },
  ],
}
