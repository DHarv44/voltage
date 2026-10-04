import type { ModuleSpec } from '../types'
import { BLACK, BLUE } from './panels'

export const midi: ModuleSpec = {
  type: 'midi',
  title: 'MIDI·CV',
  name: 'MIDI to CV',
  tagline: 'Mono MIDI/keyboard interface: pitch, gate, velocity, mod',
  category: 'I/O',
  hp: 8,
  panel: BLUE,
  inputs: [],
  outputs: [
    { id: 'pitch', label: '1V/OCT' },
    { id: 'gate', label: 'GATE' },
    { id: 'vel', label: 'VEL' },
    { id: 'mod', label: 'MOD' },
    { id: 'trig', label: 'TRIG' },
    { id: 'bend', label: 'BEND' },
  ],
  params: [
    { id: 'glide', label: 'GLIDE', min: 0, max: 1, def: 0, unit: 's' },
    { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'glide', x: 11, y: 28 },
    { kind: 'knob', param: 'oct', x: 29.6, y: 28 },
    { kind: 'led', index: 0, x: 20.3, y: 44, color: '#3bff6b' },
    { kind: 'out', jack: 'pitch', x: 11, y: 64 },
    { kind: 'out', jack: 'gate', x: 29.6, y: 64 },
    { kind: 'out', jack: 'vel', x: 11, y: 84 },
    { kind: 'out', jack: 'mod', x: 29.6, y: 84 },
    { kind: 'out', jack: 'trig', x: 11, y: 104 },
    { kind: 'out', jack: 'bend', x: 29.6, y: 104 },
    { kind: 'text', text: 'KEYS A–K · Z/X OCT', x: 20.3, y: 115, size: 1.8 },
  ],
}

export const output: ModuleSpec = {
  type: 'output',
  title: 'OUT',
  name: 'Audio Output',
  tagline: 'AC-coupled stereo out to your speakers; R normalled to L',
  category: 'I/O',
  hp: 6,
  panel: BLUE,
  inputs: [
    { id: 'l', label: 'L' },
    { id: 'r', label: 'R' },
  ],
  outputs: [],
  params: [{ id: 'vol', label: 'VOLUME', min: 0, max: 1, def: 0.6, unit: '%' }],
  leds: 2,
  controls: [
    { kind: 'knob', param: 'vol', x: 15.24, y: 28 },
    { kind: 'led', index: 0, x: 9.5, y: 46, color: '#3bff6b' },
    { kind: 'led', index: 1, x: 21, y: 46, color: '#3bff6b' },
    { kind: 'text', text: 'L', x: 9.5, y: 51.5, size: 2 },
    { kind: 'text', text: 'R', x: 21, y: 51.5, size: 2 },
    { kind: 'in', jack: 'l', x: 15.24, y: 72 },
    { kind: 'in', jack: 'r', x: 15.24, y: 94 },
    { kind: 'text', text: 'R ← L', x: 15.24, y: 103, size: 2 },
  ],
}

export const scope: ModuleSpec = {
  type: 'scope',
  title: 'SCOPE',
  name: 'Oscilloscope',
  tagline: 'Dual-trace scope with trigger and auto mode',
  category: 'Utilities',
  hp: 16,
  panel: BLACK,
  inputs: [
    { id: 'ch1', label: 'CH1' },
    { id: 'ch2', label: 'CH2' },
  ],
  outputs: [],
  params: [
    { id: 'time', label: 'TIME', min: 0.001, max: 2, def: 0.02, curve: 'exp', unit: 's/scr' },
    { id: 'g1', label: 'CH1 V/DIV', min: 0.1, max: 5, def: 2, curve: 'exp', unit: 'V/div' },
    { id: 'g2', label: 'CH2 V/DIV', min: 0.1, max: 5, def: 2, curve: 'exp', unit: 'V/div' },
    { id: 'trig', label: 'TRIGGER', min: 0, max: 1, def: 0, stepped: true, options: ['CH1', 'FREE'] },
  ],
  controls: [
    { kind: 'scope', x: 5, y: 14, w: 71.28, h: 54 },
    { kind: 'knob', param: 'time', x: 14, y: 82 },
    { kind: 'knob', param: 'g1', x: 33, y: 82 },
    { kind: 'knob', param: 'g2', x: 52, y: 82 },
    { kind: 'switch', param: 'trig', x: 70, y: 82 },
    { kind: 'in', jack: 'ch1', x: 24, y: 106 },
    { kind: 'in', jack: 'ch2', x: 48, y: 106 },
  ],
}
