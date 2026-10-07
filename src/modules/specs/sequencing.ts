import { spread } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLACK, SAND } from './panels'

export const clock: ModuleSpec = {
  type: 'clock',
  title: 'CLOCK',
  name: 'Master Clock',
  tagline: 'Tempo source: 1/16 to bar outputs, run/stop, reset',
  category: 'Sequencers',
  hp: 8,
  panel: BLACK,
  inputs: [{ id: 'reset', label: 'RESET' }],
  outputs: [
    { id: 'x4', label: '1/16' },
    { id: 'x2', label: '1/8' },
    { id: 'x1', label: '1/4' },
    { id: 'd2', label: '1/2' },
    { id: 'bar', label: 'BAR' },
    { id: 'rst', label: 'RST' },
  ],
  params: [
    { id: 'bpm', label: 'TEMPO', min: 20, max: 300, def: 120, curve: 'exp', unit: 'bpm' },
    { id: 'run', label: 'RUN', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'RUN'] },
  ],
  leds: 1,
  controls: [
    { kind: 'knob', param: 'bpm', x: 20.3, y: 27, size: 'L' },
    { kind: 'switch', param: 'run', x: 11, y: 52 },
    { kind: 'led', index: 0, x: 29.6, y: 52, color: '#ffb02e' },
    { kind: 'in', jack: 'reset', x: 20.3, y: 70 },
    { kind: 'out', jack: 'x4', x: 7.5, y: 92 },
    { kind: 'out', jack: 'x2', x: 20.3, y: 92 },
    { kind: 'out', jack: 'x1', x: 33.1, y: 92 },
    { kind: 'out', jack: 'd2', x: 7.5, y: 109 },
    { kind: 'out', jack: 'bar', x: 20.3, y: 109 },
    { kind: 'out', jack: 'rst', x: 33.1, y: 109 },
  ],
}

const DIVS = [2, 3, 4, 5, 6, 8]

export const div: ModuleSpec = {
  type: 'div',
  title: 'DIV',
  name: 'Clock Divider',
  tagline: 'Divides a clock by 2, 3, 4, 5, 6 and 8',
  category: 'Sequencers',
  hp: 6,
  panel: BLACK,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'reset', label: 'RST' },
  ],
  outputs: DIVS.map((n) => ({ id: `d${n}`, label: `÷${n}` })),
  params: [],
  controls: [
    { kind: 'in', jack: 'clk', x: 8.5, y: 28 },
    { kind: 'in', jack: 'reset', x: 22, y: 28 },
    ...DIVS.map(
      (n, i): Control => ({ kind: 'out', jack: `d${n}`, x: i % 2 ? 22 : 8.5, y: 62 + Math.floor(i / 2) * 20 }),
    ),
  ],
}

const STEPS = 8
/** Step columns across the full 18 HP, far enough apart that the step knobs'
 *  tick rings clear each other. */
const STEP_X = spread(18 * HP_MM, STEPS, 12)
const stepX = (i: number) => STEP_X[i]

export const seq8: ModuleSpec = {
  type: 'seq8',
  title: 'SEQ-8',
  name: '8-Step Sequencer',
  tagline: 'Classic analog step sequencer: per-step pitch + gate, length, quantize',
  category: 'Sequencers',
  hp: 18,
  panel: SAND,
  inputs: [
    { id: 'clk', label: 'CLOCK' },
    { id: 'reset', label: 'RESET' },
  ],
  outputs: [
    { id: 'cv', label: 'CV' },
    { id: 'gate', label: 'GATE' },
    { id: 'trig', label: 'TRIG' },
  ],
  params: [
    ...Array.from({ length: STEPS }, (_, i): ParamSpec => ({
      id: `s${i + 1}`,
      label: `STEP ${i + 1}`,
      min: 0,
      max: 2,
      def: [0, 0.25, 0.5833, 0.25, 0.8333, 0.5833, 0.4167, 1][i],
      unit: 'V',
    })),
    ...Array.from({ length: STEPS }, (_, i): ParamSpec => ({
      id: `g${i + 1}`,
      label: `GATE ${i + 1}`,
      min: 0,
      max: 1,
      def: 1,
      stepped: true,
      options: ['OFF', 'ON'],
    })),
    { id: 'len', label: 'LENGTH', min: 1, max: STEPS, def: STEPS, stepped: true },
    { id: 'quant', label: 'QUANT', min: 0, max: 1, def: 1, stepped: true, options: ['FREE', 'SEMI'] },
  ],
  leds: STEPS,
  controls: [
    ...Array.from({ length: STEPS }, (_, i): Control[] => [
      { kind: 'knob', param: `s${i + 1}`, x: stepX(i), y: 28, size: 'S', label: String(i + 1) },
      { kind: 'led', index: i, x: stepX(i), y: 40, color: '#ff3b2f' },
      { kind: 'switch', param: `g${i + 1}`, x: stepX(i), y: 53 },
    ]).flat(),
    { kind: 'knob', param: 'len', x: 13, y: 82 },
    { kind: 'switch', param: 'quant', x: STEP_X[2], y: 82 },
    { kind: 'in', jack: 'clk', x: 48, y: 82 },
    { kind: 'in', jack: 'reset', x: 60, y: 82 },
    { kind: 'out', jack: 'cv', x: 48, y: 106 },
    { kind: 'out', jack: 'gate', x: 60, y: 106 },
    { kind: 'out', jack: 'trig', x: 72, y: 106 },
  ],
}
