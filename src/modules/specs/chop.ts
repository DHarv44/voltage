import type { Control, ModuleSpec } from '../types'
import { DRUM } from './panels'

export const CHOP_PADS = 16
export const CHOP_RATES = ['1/8', '1/16', '1/16T', '1/32']
export const CHOPL = {
  /** Pad glow (0..15) then: recording, progress. */
  rec: 16,
  pos: 17,
  repeat: 18,
} as const

const PAD_X = [12, 26, 40, 54]
const PAD_Y = [69, 55, 41, 27]

/** MPC-style chopper. A sample (recorded from IN, loaded, or the factory battle
 *  record) is chopped onto 16 pads — at its transients, or evenly. Hold
 *  REPEAT and a pad for note repeat at RATE with MPC swing; VINTAGE goes from
 *  clean through 12-bit/40 kHz (MPC60) to 12-bit/26 kHz (SP-1200) grit.
 *  MIDI notes 36–51 play the pads (bank A), like an MPC. */
export const chop: ModuleSpec = {
  type: 'chop',
  title: 'CHOP',
  name: 'Pad Sampler (MPC-style)',
  tagline: '16 pads chopped from a sample at its transients; note repeat with swing; 12-bit vintage grit',
  category: 'Sampling & Tape',
  hp: 24,
  panel: DRUM,
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'rec', label: 'REC' },
    { id: 'clk', label: 'CLK' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'trig', label: 'TRIG' },
    { id: 'pad', label: 'PAD' },
  ],
  params: [
    { id: 'tempo', label: 'TEMPO', min: 60, max: 180, def: 92, unit: 'bpm' },
    { id: 'swing', label: 'SWING', min: 0.5, max: 0.75, def: 0.58, unit: '%' },
    { id: 'rate', label: 'RATE', min: 0, max: 3, def: 1, stepped: true, options: CHOP_RATES },
    { id: 'vintage', label: 'VINTAGE', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'pitch', label: 'PITCH', min: -12, max: 12, def: 0, unit: 'st' },
    { id: 'level', label: 'LEVEL', min: 0, max: 1.5, def: 1, unit: '%' },
    { id: 'mode', label: 'CHOP', min: 0, max: 1, def: 1, stepped: true, options: ['EVEN', 'HITS'] },
  ],
  leds: 19,
  controls: [
    ...Array.from({ length: CHOP_PADS }, (_, i): Control => ({
      kind: 'pad',
      index: i,
      x: PAD_X[i % 4],
      y: PAD_Y[Math.floor(i / 4)],
      size: 11.5,
      label: String(i + 1),
      led: i,
    })),
    { kind: 'button', name: 'rec', x: 74, y: 26, label: 'REC', led: CHOPL.rec, ledColor: '#ff3b2f' },
    { kind: 'file', slot: 0, x: 90, y: 26, label: 'LOAD' },
    { kind: 'button', name: 'repeat', x: 106, y: 26, label: 'REPEAT', led: CHOPL.repeat, ledColor: '#ffd25a' },
    { kind: 'knob', param: 'tempo', x: 74, y: 46, size: 'S' },
    { kind: 'knob', param: 'swing', x: 90, y: 46, size: 'S' },
    { kind: 'knob', param: 'rate', x: 106, y: 46, size: 'S' },
    { kind: 'knob', param: 'vintage', x: 74, y: 63, size: 'S' },
    { kind: 'knob', param: 'pitch', x: 90, y: 63, size: 'S' },
    { kind: 'knob', param: 'level', x: 106, y: 63, size: 'S' },
    { kind: 'switch', param: 'mode', x: 90, y: 79 },
    { kind: 'progress', x: 6, y: 81, w: 54, led: CHOPL.pos },
    { kind: 'in', jack: 'in', x: 12, y: 104 },
    { kind: 'in', jack: 'rec', x: 26, y: 104 },
    { kind: 'in', jack: 'clk', x: 40, y: 104 },
    { kind: 'out', jack: 'trig', x: 80, y: 113.5 },
    { kind: 'out', jack: 'pad', x: 94, y: 113.5 },
    { kind: 'out', jack: 'out', x: 108, y: 113.5 },
  ],
}
