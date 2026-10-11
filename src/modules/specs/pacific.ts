import type { Control, ModuleSpec, ParamSpec } from '../types'
import { BLACK } from './panels'

export const PC_STEPS = 5
/** LEDs: one per step, the pulser, the envelope. */
export const PCL = { step: 0, pulse: PC_STEPS, env: PC_STEPS + 1 } as const

/** Two knob rows for the voice, two for the sequencer, pulser and envelope. */
const COL = Array.from({ length: 12 }, (_, i) => 10 + 15.5 * i)
const R1 = 31
const R2 = 53
const R3 = 83
const R4 = 105
const PATCH_X = [201.5, 212.5, 223.5, 234.5]
const IN_ROWS = [31, 43.5, 56]
const OUT_ROWS = [90, 106]

/** C, E♭, G, B♭, F: a five-note phrase that walks. */
const STEPS = [0, 3, 7, 10, 5].map((s) => s / 12)

const inputs = [
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'pulse', label: 'PULSE' },
  { id: 'clk', label: 'SEQ ADV' },
  { id: 'rst', label: 'SEQ RST' },
  { id: 'fm', label: 'FM' },
  { id: 'timbre', label: 'TIMBRE' },
  { id: 'mod', label: 'MOD CV' },
  { id: 'pitch', label: 'PITCH' },
  { id: 'lpg1', label: 'GATE 1' },
  { id: 'lpg2', label: 'GATE 2' },
  { id: 'ext', label: 'EXT IN' },
]
const outputs = [
  { id: 'out', label: 'OUT' },
  { id: 'cplx', label: 'COMPLEX' },
  { id: 'modo', label: 'MOD' },
  { id: 'envo', label: 'ENV' },
  { id: 'seqo', label: 'SEQ' },
  { id: 'pulso', label: 'PULSE' },
  { id: 'kcv', label: 'KEY CV' },
  { id: 'kgate', label: 'GATE' },
]

const level = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0, max: 1, def, unit: '%' })
const time = (id: string, label: string, min: number, max: number, def: number): ParamSpec => ({ id, label, min, max, def, curve: 'exp', unit: 's' })
const toggle = (id: string, label: string, options: string[], def = 0): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })

const params: ParamSpec[] = [
  // modulation oscillator
  { id: 'mfreq', label: 'MOD FREQ', min: 0.05, max: 2000, def: 261.6, curve: 'exp', unit: 'Hz' },
  toggle('mwave', 'MOD WAVE', ['SAW', 'SQR', 'TRI'], 2),
  toggle('mtrack', 'MOD PITCH', ['FREE', 'FOLLOW'], 1),
  level('fm', 'FM DEPTH', 0.22),
  // complex oscillator
  { id: 'pitch', label: 'PITCH', min: 20, max: 2000, def: 130.8, curve: 'exp', unit: 'Hz' },
  toggle('cwave', 'WAVESHAPE', ['SPIKE', 'SQR', 'TRI'], 0),
  level('timbre', 'TIMBRE', 0.3),
  { id: 'sym', label: 'SYMMETRY', min: -1, max: 1, def: 0.1, unit: '%' },
  level('wmix', 'BLEND', 0.65),
  toggle('psrc', 'PITCH FROM', ['KEYS', 'SEQ', 'KEYS+SEQ'], 2),
  toggle('tsrc', 'TIMBRE MOD', ['MOD OSC', 'ENV', 'SEQ'], 1),
  level('tmod', 'TIMBRE DEPTH', 0.45),
  // the gates
  toggle('g1src', 'GATE 1 FROM', ['ENV', 'PULSER', 'SEQ'], 0),
  toggle('g1mode', 'GATE 1 MODE', ['LP', 'COMBO', 'VCA'], 1),
  level('g1lvl', 'GATE 1 LEVEL', 0.9),
  toggle('g2src', 'GATE 2 FROM', ['ENV', 'PULSER', 'SEQ'], 0),
  toggle('g2mode', 'GATE 2 MODE', ['LP', 'COMBO', 'VCA'], 1),
  level('g2lvl', 'GATE 2 LEVEL', 0),
  level('rev', 'REVERB', 0.25),
  level('vol', 'VOLUME', 0.7),
  // sequencer, pulser, envelope, keys
  ...STEPS.map((def, i): ParamSpec => ({ id: `s${i}`, label: `STEP ${i + 1}`, min: -1, max: 1, def, unit: 'oct' })),
  toggle('steps', 'STEPS', ['3', '4', '5'], 2),
  toggle('sclk', 'SEQ FROM', ['PULSER', 'KEYS'], 0),
  { id: 'prate', label: 'PULSER RATE', min: 0.2, max: 30, def: 4, curve: 'exp', unit: 'Hz' },
  toggle('pmode', 'PULSER', ['SELF', 'KEYS', 'OFF'], 0),
  time('att', 'ATTACK', 0.001, 5, 0.003),
  time('sus', 'SUSTAIN', 0.001, 4, 0.001),
  time('dec', 'DECAY', 0.01, 8, 0.4),
  toggle('emode', 'ENV MODE', ['TRANSIENT', 'SUSTAINED', 'CYCLE'], 0),
  toggle('etrig', 'ENV FROM', ['PULSER', 'KEYS', 'SEQ'], 0),
  { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
  time('glide', 'PORTAMENTO', 0.001, 2, 0.001),
  toggle('quant', 'STEP PITCH', ['FREE', 'SEMITONES'], 1),
]

const place = (id: string | null, x: number, y: number): Control[] => {
  if (!id) return []
  const ps = params.find((p) => p.id === id)!
  return [ps.stepped ? { kind: 'switch', param: id, x, y } : { kind: 'knob', param: id, x, y }]
}
const ROW1 = ['mfreq', 'mwave', 'mtrack', 'pitch', 'cwave', 'timbre', 'sym', null, null, null, null, 'rev']
const ROW2 = ['fm', null, null, 'psrc', 'tsrc', 'tmod', 'wmix', null, null, null, null, 'vol']
/** The gates' switches need room for their option labels: three across four columns. */
const GATE_X = [COL[7], COL[7] + 18, COL[10]]
const box = (a: number, b: number, y: number, h: number, label: string): Control => ({ kind: 'section', x: COL[a] - 7, y, w: COL[b] - COL[a] + 14, h, label })

/** A west-coast system in the Music Easel tradition (our own panel and
 *  sound): a complex oscillator whose TIMBRE is a wavefolder on its sine,
 *  frequency-modulated by a modulation oscillator; two low-pass gates (the
 *  vactrol's slow, darkening decay is the "bongo"); a pulser, an envelope
 *  (transient, sustained or cycling) and a five-step sequencer, routed by
 *  switches the way the original's pins were. Plays from the keys or V/OCT +
 *  GATE; the patch bay's inputs break their normals. */
export const pacific: ModuleSpec = {
  type: 'pacific',
  title: 'PACIFIC',
  name: 'PACIFIC West-Coast System',
  tagline: 'Complex oscillator with a wavefolder, modulation oscillator, two vactrol low-pass gates, pulser, envelope and a five-step sequencer',
  category: 'Systems',
  hp: 48,
  panel: BLACK,
  inputs,
  outputs,
  params,
  leds: PCL.env + 1,
  settings: ['quant'],
  controls: [
    box(0, 2, 16, 47.5, 'MODULATION OSC'),
    box(3, 6, 16, 47.5, 'COMPLEX OSC'),
    box(7, 10, 16, 47.5, 'LOW-PASS GATES'),
    box(11, 11, 16, 47.5, 'OUT'),
    ...ROW1.flatMap((id, i) => place(id, COL[i], R1)),
    ...ROW2.flatMap((id, i) => place(id, COL[i], R2)),
    ...['g1src', 'g1mode', 'g1lvl'].flatMap((id, i) => place(id, GATE_X[i], R1)),
    ...['g2src', 'g2mode', 'g2lvl'].flatMap((id, i) => place(id, GATE_X[i], R2)),
    { kind: 'text', text: 'GATE 1 · COMPLEX', x: (GATE_X[0] + GATE_X[1]) / 2, y: R1 - 9.4, size: 1.4 },
    { kind: 'text', text: 'GATE 2 · MOD', x: (GATE_X[0] + GATE_X[1]) / 2, y: R2 - 9.4, size: 1.4 },
    { kind: 'text', text: 'FM →', x: COL[1] + 3, y: R2 + 0.7, size: 1.8 },

    box(0, 4, 65, 55, 'SEQUENTIAL VOLTAGES'),
    ...STEPS.flatMap((_, i): Control[] => [
      { kind: 'led', index: PCL.step + i, x: COL[i], y: 71.5, color: '#ff6a1a' },
      { kind: 'knob', param: `s${i}`, x: COL[i], y: R3, size: 'S', label: String(i + 1) },
    ]),
    { kind: 'switch', param: 'steps', x: COL[0], y: R4 },
    { kind: 'switch', param: 'sclk', x: COL[1], y: R4 },
    box(5, 6, 65, 55, 'PULSER'),
    { kind: 'knob', param: 'prate', x: COL[5], y: R3 },
    { kind: 'led', index: PCL.pulse, x: COL[6], y: R3, color: '#ff6a1a' },
    { kind: 'switch', param: 'pmode', x: COL[5], y: R4 },
    box(7, 9, 65, 55, 'ENVELOPE'),
    { kind: 'knob', param: 'att', x: COL[7], y: R3 },
    { kind: 'knob', param: 'sus', x: COL[8], y: R3 },
    { kind: 'knob', param: 'dec', x: COL[9], y: R3 },
    { kind: 'switch', param: 'emode', x: COL[7], y: R4 },
    { kind: 'led', index: PCL.env, x: COL[8] + 2, y: R4, color: '#ffb347' },
    { kind: 'switch', param: 'etrig', x: COL[9] - 3, y: R4 },
    box(10, 11, 65, 55, 'KEYS'),
    { kind: 'knob', param: 'oct', x: COL[10], y: R3 },
    { kind: 'knob', param: 'glide', x: COL[11], y: R3 },
    { kind: 'text', text: 'PLAY THE KEYS', x: (COL[10] + COL[11]) / 2, y: R4 - 2, size: 1.6 },
    { kind: 'text', text: 'OR V/OCT + GATE', x: (COL[10] + COL[11]) / 2, y: R4 + 2, size: 1.6 },

    { kind: 'section', x: 195, y: 16, w: 45.5, h: 104, label: 'PATCH BAY' },
    { kind: 'text', text: 'INPUTS', x: 218, y: 21.5, size: 1.8 },
    ...inputs.map((j, i): Control => ({ kind: 'in', jack: j.id, x: PATCH_X[i % 4], y: IN_ROWS[Math.floor(i / 4)] })),
    { kind: 'text', text: 'OUTPUTS', x: 218, y: 77.5, size: 1.8 },
    ...outputs.map((j, i): Control => ({ kind: 'out', jack: j.id, x: PATCH_X[i % 4], y: OUT_ROWS[Math.floor(i / 4)] })),
    { kind: 'text', text: 'PATCHING AN INPUT BREAKS ITS NORMAL', x: 218, y: 116, size: 1.4 },
  ],
}
