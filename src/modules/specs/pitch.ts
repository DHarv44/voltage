import type { ModuleSpec } from '../types'
import { BLUE, SAND } from './panels'

export const ARP_MODES = ['UP', 'DOWN', 'UP/DN', 'RANDOM', 'ORDER']

export const arp: ModuleSpec = {
  type: 'arp',
  title: 'ARP',
  name: 'Arpeggiator',
  tagline: 'Arpeggiates the notes you hold (keys/MIDI): 5 modes, 1–4 octaves, latch',
  category: 'Sequencing',
  hp: 10,
  panel: BLUE,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [
    { id: 'pitch', label: '1V/OCT' },
    { id: 'gate', label: 'GATE' },
    { id: 'trig', label: 'TRIG' },
  ],
  params: [
    { id: 'mode', label: 'MODE', min: 0, max: ARP_MODES.length - 1, def: 0, stepped: true, options: ARP_MODES },
    { id: 'oct', label: 'OCTAVES', min: 1, max: 4, def: 1, stepped: true },
    { id: 'rate', label: 'RATE', min: 0.5, max: 20, def: 6, curve: 'exp', unit: 'Hz' },
    { id: 'len', label: 'GATE LEN', min: 0.05, max: 1, def: 0.5, unit: '%' },
    { id: 'latch', label: 'LATCH', min: 0, max: 1, def: 0, stepped: true, options: ['OFF', 'ON'] },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'mode', x: 13, y: 26 },
    { kind: 'knob', param: 'oct', x: 38, y: 26 },
    { kind: 'knob', param: 'rate', x: 13, y: 48 },
    { kind: 'knob', param: 'len', x: 38, y: 48 },
    { kind: 'switch', param: 'latch', x: 25.4, y: 64 },
    { kind: 'led', index: 0, x: 38, y: 64, color: '#3bff6b' },
    { kind: 'text', text: 'CLK IN OVERRIDES RATE', x: 25.4, y: 75.5, size: 1.6 },
    { kind: 'in', jack: 'clk', x: 13, y: 87 },
    { kind: 'in', jack: 'rst', x: 38, y: 87 },
    { kind: 'out', jack: 'pitch', x: 10, y: 108 },
    { kind: 'out', jack: 'gate', x: 25.4, y: 108 },
    { kind: 'out', jack: 'trig', x: 40.8, y: 108 },
  ],
}

export const CHORD_NAMES = ['MAJ', 'MIN', 'SUS2', 'SUS4', 'MAJ7', 'MIN7', 'DOM7', 'DIM']

export const chord: ModuleSpec = {
  type: 'chord',
  title: 'CHORD',
  name: 'Chord Generator',
  tagline: 'One pitch in, four voices out: 8 chord qualities, inversions, open voicing',
  category: 'Sequencing',
  hp: 8,
  panel: SAND,
  inputs: [
    { id: 'root', label: 'ROOT' },
    { id: 'qcv', label: 'QUAL CV' },
  ],
  outputs: [
    { id: 'v1', label: 'VOICE 1' },
    { id: 'v2', label: 'VOICE 2' },
    { id: 'v3', label: 'VOICE 3' },
    { id: 'v4', label: 'VOICE 4' },
  ],
  params: [
    { id: 'qual', label: 'QUALITY', min: 0, max: CHORD_NAMES.length - 1, def: 0, stepped: true, options: CHORD_NAMES },
    { id: 'inv', label: 'INVERSION', min: 0, max: 3, def: 0, stepped: true },
    { id: 'spread', label: 'VOICING', min: 0, max: 1, def: 0, stepped: true, options: ['CLOSE', 'OPEN'] },
  ],
  controls: [
    { kind: 'knob', param: 'qual', x: 11, y: 26 },
    { kind: 'knob', param: 'inv', x: 29.6, y: 26 },
    { kind: 'switch', param: 'spread', x: 20.3, y: 45 },
    { kind: 'in', jack: 'root', x: 11, y: 66 },
    { kind: 'in', jack: 'qcv', x: 29.6, y: 66 },
    { kind: 'out', jack: 'v1', x: 11, y: 88 },
    { kind: 'out', jack: 'v2', x: 29.6, y: 88 },
    { kind: 'out', jack: 'v3', x: 11, y: 108 },
    { kind: 'out', jack: 'v4', x: 29.6, y: 108 },
  ],
}
