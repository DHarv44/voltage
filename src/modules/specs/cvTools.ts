import type { Control, ModuleSpec, ParamSpec } from '../types'
import { ALU, BLACK, SLATE } from './panels'
import { rows } from './stereoTools'

const knob = (param: string, size: 'S' | 'M' = 'S'): Control => ({ kind: 'knob', param, x: 0, y: 0, size })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const led = (index: number, bipolar = false): Control => ({ kind: 'led', index, x: 0, y: 0, bipolar })
const FOUR = [1, 2, 3, 4]

// ---- QUAD LFO ----

export const QLFO_SHAPES = ['SINE', 'TRI', 'SAW', 'SQUARE', 'S&H']
/** PHASE: one rate, the four spread round the cycle; RATIO: ×1 ×2 ×3 ×4 (or
 *  closer, by SPREAD); DRIFT: each wanders off its own way, never repeating. */
export const QLFO_MODES = ['PHASE', 'RATIO', 'DRIFT']

const qParams: ParamSpec[] = [
  { id: 'rate', label: 'RATE', min: 0.01, max: 20, def: 0.4, curve: 'exp', unit: 'Hz' },
  { id: 'shape', label: 'SHAPE', min: 0, max: QLFO_SHAPES.length - 1, def: 0, stepped: true, options: QLFO_SHAPES },
  { id: 'mode', label: 'MODE', min: 0, max: QLFO_MODES.length - 1, def: 0, stepped: true, options: QLFO_MODES },
  { id: 'spread', label: 'SPREAD', min: 0, max: 1, def: 1, unit: '%' },
  { id: 'depth', label: 'DEPTH', min: 0, max: 1, def: 1, unit: '%' },
]
const qIn: ModuleSpec['inputs'] = [
  { id: 'rate', label: 'RATE' },
  { id: 'rst', label: 'RST' },
]
const qOut: ModuleSpec['outputs'] = FOUR.map((n) => ({ id: `o${n}`, label: `${n}` }))

/** Four LFOs from one RATE, in a relationship: a quarter-cycle apart
 *  (quadrature, for circling pans and moving chords), at ratios, or drifting. */
export const qlfo: ModuleSpec = {
  type: 'qlfo',
  title: 'QUAD LFO',
  name: 'Quad LFO',
  tagline: 'Four LFOs from one RATE: a quarter-cycle apart, at ratios ×1–×4, or drifting apart; five shapes; RST lines them up',
  category: 'Envelopes & LFOs',
  hp: 10,
  panel: SLATE,
  inputs: qIn,
  outputs: qOut,
  params: qParams,
  leds: 4,
  controls: rows(10, [[knob('rate', 'M'), knob('shape')], [knob('mode'), knob('spread'), knob('depth')], [jack('in', 'rate'), jack('in', 'rst')], FOUR.map((n) => led(n - 1, true)), FOUR.map((n) => jack('out', `o${n}`))], {
    params: qParams,
    inputs: qIn,
    outputs: qOut,
  }),
}

// ---- CHANCE: two Bernoulli gates ----

export const CHANCE_MODES = ['GATE', 'LATCH']

const cParams: ParamSpec[] = [
  { id: 'p1', label: 'CHANCE 1', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'p2', label: 'CHANCE 2', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'mode', label: 'MODE', min: 0, max: CHANCE_MODES.length - 1, def: 0, stepped: true, options: CHANCE_MODES },
]
const cIn: ModuleSpec['inputs'] = [
  { id: 'in1', label: 'IN 1' },
  { id: 'cv1', label: 'CV 1' },
  { id: 'in2', label: 'IN 2' },
  { id: 'cv2', label: 'CV 2' },
]
const cOut: ModuleSpec['outputs'] = [
  { id: 'a1', label: 'A 1' },
  { id: 'b1', label: 'B 1' },
  { id: 'a2', label: 'A 2' },
  { id: 'b2', label: 'B 2' },
]

/** Two coin tosses: each gate in goes out of A or of B, CHANCE deciding how
 *  often it's B. IN 2 is normalled to IN 1. LATCH holds the last side until
 *  the next toss. */
export const chance: ModuleSpec = {
  type: 'chance',
  title: 'CHANCE',
  name: 'Chance Gates',
  tagline: 'Two coin tosses: each gate goes to A or B, CHANCE sets the odds (Bernoulli gates); LATCH holds the result',
  category: 'CV Tools',
  hp: 8,
  panel: BLACK,
  inputs: cIn,
  outputs: cOut,
  params: cParams,
  leds: 4,
  controls: rows(8, [[knob('p1'), knob('p2')], [sw('mode')], [jack('in', 'in1'), jack('in', 'in2')], [jack('in', 'cv1'), jack('in', 'cv2')], [led(0), led(1), led(2), led(3)], [jack('out', 'a1'), jack('out', 'b1')], [jack('out', 'a2'), jack('out', 'b2')]], {
    params: cParams,
    inputs: cIn,
    outputs: cOut,
  }, 2),
}

// ---- SWITCH: sequential switch ----

export const SWITCH_ORDERS = ['UP', 'PING-PONG', 'RANDOM']

const sParams: ParamSpec[] = [
  { id: 'steps', label: 'STEPS', min: 2, max: 4, def: 4, stepped: true },
  { id: 'order', label: 'ORDER', min: 0, max: SWITCH_ORDERS.length - 1, def: 0, stepped: true, options: SWITCH_ORDERS },
]
const sIn: ModuleSpec['inputs'] = [...FOUR.map((n) => ({ id: `in${n}`, label: `IN ${n}` })), { id: 'x', label: 'X' }, { id: 'clk', label: 'CLK' }, { id: 'rst', label: 'RST' }, { id: 'sel', label: 'SELECT' }]
const sOut: ModuleSpec['outputs'] = [{ id: 'out', label: 'OUT' }, ...FOUR.map((n) => ({ id: `x${n}`, label: `X→${n}` }))]

/** A sequential switch, both ways at once: each clock moves to the next of
 *  the four; OUT plays whichever IN is selected, and X goes out of the
 *  selected X→ jack. SELECT (0–10 V) picks one directly. */
export const sswitch: ModuleSpec = {
  type: 'sswitch',
  title: 'SWITCH',
  name: 'Sequential Switch',
  tagline: 'Each clock steps to the next of four: four inputs into one OUT, and X out to one of four; SELECT picks by voltage',
  category: 'CV Tools',
  hp: 10,
  panel: ALU,
  inputs: sIn,
  outputs: sOut,
  params: sParams,
  leds: 4,
  controls: rows(10, [[knob('steps'), knob('order')], FOUR.map((n) => jack('in', `in${n}`)), FOUR.map((n) => led(n - 1)), [jack('in', 'clk'), jack('in', 'rst'), jack('in', 'sel'), jack('out', 'out')], [jack('in', 'x'), ...FOUR.slice(0, 3).map((n) => jack('out', `x${n}`))], [null, null, null, jack('out', 'x4')]], {
    params: sParams,
    inputs: sIn,
    outputs: sOut,
  }, 2),
}

// ---- TRACK & HOLD ----

/** TRACK: follows while the gate is high, holds when it drops. S&H: samples
 *  on each rise. HOLD: holds while high, follows while low. */
export const TH_MODES = ['TRACK', 'S&H', 'HOLD']

const tParams: ParamSpec[] = [
  { id: 'm1', label: 'MODE 1', min: 0, max: TH_MODES.length - 1, def: 0, stepped: true, options: TH_MODES },
  { id: 'm2', label: 'MODE 2', min: 0, max: TH_MODES.length - 1, def: 1, stepped: true, options: TH_MODES },
]
const tIn: ModuleSpec['inputs'] = [
  { id: 'in1', label: 'IN 1' },
  { id: 'g1', label: 'GATE 1' },
  { id: 'in2', label: 'IN 2' },
  { id: 'g2', label: 'GATE 2' },
]
const tOut: ModuleSpec['outputs'] = [
  { id: 'out1', label: 'OUT 1' },
  { id: 'out2', label: 'OUT 2' },
]

/** Two track & holds. Unpatched IN 1 follows a slow random wander (so the
 *  gate alone makes melodies); IN 2 and GATE 2 are normalled to channel 1. */
export const trackhold: ModuleSpec = {
  type: 'trackhold',
  title: 'T&H',
  name: 'Track & Hold',
  tagline: 'Two track & holds: follow while the gate is high, freeze when it drops (or sample & hold, or the reverse)',
  category: 'CV Tools',
  hp: 8,
  panel: ALU,
  inputs: tIn,
  outputs: tOut,
  params: tParams,
  leds: 2,
  controls: rows(8, [[knob('m1'), knob('m2')], [jack('in', 'in1'), jack('in', 'in2')], [jack('in', 'g1'), jack('in', 'g2')], [led(0, true), led(1, true)], [jack('out', 'out1'), jack('out', 'out2')]], {
    params: tParams,
    inputs: tIn,
    outputs: tOut,
  }),
}
