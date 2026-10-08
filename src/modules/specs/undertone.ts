import type { Control, ModuleSpec, ParamSpec } from '../types'
import { SLATE } from './panels'

export const UT_STEPS = 4
export const UT_RHYTHMS = 4
export const UT_QUANT = ['OFF', '12-ET', '8-ET', '12-JI', '8-JI']
/** Sequencer range per RANGE switch position (octaves), and the division
 *  offset a step's full turn gives a sub it's assigned to. */
export const UT_RANGE_OCT = [1, 2, 5]
export const UT_RANGE_DIV = [4, 8, 15]
/** Assign bits: which of its oscillator's parts a sequencer moves. */
export const UT_ASSIGN = { osc: 1, sub1: 2, sub2: 4 } as const
/** LED layout: SEQ 1 steps, SEQ 2 steps, a flash per rhythm, the tempo
 *  blink, and a constant −1 for the toggle grids (no playhead). */
export const UTL = { seq1: 0, seq2: UT_STEPS, rhythm: UT_STEPS * 2, tempo: UT_STEPS * 2 + UT_RHYTHMS, none: UT_STEPS * 2 + UT_RHYTHMS + 1 } as const

const COL = Array.from({ length: 15 }, (_, i) => 10 + 15.5 * i)
const R1 = 31
const R2 = 53
const R3 = 80
const R4 = 102
const PATCH_X = [248, 259, 270, 281, 292]
const IN_ROWS = [31, 45, 59]
const OUT_ROWS = [80, 94.5, 109]

const inputs = [
  { id: 'vco1', label: 'VCO 1' },
  { id: 'sub11', label: 'SUB 1-1' },
  { id: 'sub12', label: 'SUB 1-2' },
  { id: 'vco2', label: 'VCO 2' },
  { id: 'sub21', label: 'SUB 2-1' },
  { id: 'sub22', label: 'SUB 2-2' },
  { id: 'cutoff', label: 'CUTOFF' },
  { id: 'vca', label: 'VCA' },
  { id: 'play', label: 'PLAY' },
  { id: 'reset', label: 'RESET' },
  { id: 'clock', label: 'CLOCK' },
  ...Array.from({ length: UT_RHYTHMS }, (_, i) => ({ id: `rhy${i + 1}`, label: `RHY ${i + 1}` })),
]
const outputs = [
  { id: 'vca', label: 'VCA' },
  { id: 'vco1', label: 'VCO 1' },
  { id: 'sub1', label: 'SUB 1' },
  { id: 'vco2', label: 'VCO 2' },
  { id: 'sub2', label: 'SUB 2' },
  { id: 'vcfeg', label: 'VCF EG' },
  { id: 'vcaeg', label: 'VCA EG' },
  { id: 'seq1', label: 'SEQ 1' },
  { id: 'seq2', label: 'SEQ 2' },
  { id: 'clk', label: 'CLK' },
  { id: 'rsto', label: 'RST' },
]

const time = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0.001, max: 10, def, curve: 'exp', unit: 's' })
const level = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0, max: 1, def, unit: '%' })
const div = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 1, max: 16, def, stepped: true })
const toggle = (id: string, label: string, options: string[], def = 0): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })
const mask = (id: string, label: string, def: number, bits: number): ParamSpec => ({ id, label, min: 0, max: (1 << bits) - 1, def, stepped: true })

/** Each oscillator: its frequency, two subharmonic divisors, three levels. */
const osc = (n: 1 | 2, hz: number, subs: [number, number], levels: [number, number, number]): ParamSpec[] => [
  { id: `vco${n}`, label: `VCO${n} FREQ`, min: 20, max: 2000, def: hz, curve: 'exp', unit: 'Hz' },
  div(`s${n}1`, `VCO${n} SUB 1 ÷`, subs[0]),
  div(`s${n}2`, `VCO${n} SUB 2 ÷`, subs[1]),
  level(`l${n}`, `VCO${n} LEVEL`, levels[0]),
  level(`l${n}1`, `VCO${n} SUB 1 LEVEL`, levels[1]),
  level(`l${n}2`, `VCO${n} SUB 2 LEVEL`, levels[2]),
]
const SEQ1 = [0, 0.25, -0.17, 0.42]
const SEQ2 = [0, -0.25, 0.17, 0.08]
const RHYTHMS = [2, 3, 4, 7]

const params: ParamSpec[] = [
  ...osc(1, 98, [2, 3], [0.55, 0.4, 0.3]),
  ...osc(2, 147, [4, 5], [0.4, 0.3, 0.25]),
  toggle('wave1', 'VCO1 WAVE', ['SAW', 'SQR']),
  toggle('wave2', 'VCO2 WAVE', ['SAW', 'SQR'], 1),
  { id: 'cutoff', label: 'CUTOFF', min: 20, max: 18000, def: 1100, curve: 'exp', unit: 'Hz' },
  { id: 'res', label: 'RESONANCE', min: 0, max: 1.1, def: 0.3, unit: '%' },
  { id: 'vcfeg', label: 'VCF EG AMT', min: -1, max: 1, def: 0.4, unit: '%' },
  time('vcfa', 'VCF ATTACK', 0.005),
  time('vcfd', 'VCF DECAY', 0.35),
  time('vcaa', 'VCA ATTACK', 0.005),
  time('vcad', 'VCA DECAY', 0.45),
  toggle('vcamode', 'VCA MODE', ['ENV', 'DRONE']),
  level('vol', 'VOLUME', 0.6),
  { id: 'quant', label: 'QUANTIZE', min: 0, max: UT_QUANT.length - 1, def: 1, stepped: true, options: UT_QUANT },
  toggle('range', 'SEQ RANGE', ['±1', '±2', '±5']),
  { id: 'glide', label: 'GLIDE', min: 0, max: 1, def: 0, unit: 's' },
  ...SEQ1.map((def, i): ParamSpec => ({ id: `a${i}`, label: `SEQ1 STEP ${i + 1}`, min: -1, max: 1, def, unit: '%' })),
  ...SEQ2.map((def, i): ParamSpec => ({ id: `b${i}`, label: `SEQ2 STEP ${i + 1}`, min: -1, max: 1, def, unit: '%' })),
  mask('as1', 'SEQ1 ASSIGN', UT_ASSIGN.osc, 3),
  mask('as2', 'SEQ2 ASSIGN', UT_ASSIGN.osc, 3),
  ...RHYTHMS.map((def, i) => div(`r${i + 1}`, `RHYTHM ${i + 1} ÷`, def)),
  mask('rt1', 'SEQ1 RHYTHMS', 0b0101, UT_RHYTHMS),
  mask('rt2', 'SEQ2 RHYTHMS', 0b1010, UT_RHYTHMS),
  toggle('logic', 'LOGIC', ['OR', 'XOR']),
  { id: 'tempo', label: 'TEMPO', min: 20, max: 300, def: 100, curve: 'exp', unit: 'bpm' },
  toggle('run', 'PLAY', ['STOP', 'PLAY']),
]

const knob = (param: string, x: number, y: number, label?: string): Control => ({ kind: 'knob', param, x, y, ...(label !== undefined ? { label } : {}) })
const sw = (param: string, x: number, y: number): Control => ({ kind: 'switch', param, x, y })
const box = (a: number, b: number, y: number, h: number, label: string): Control => ({ kind: 'section', x: COL[a] - 7, y, w: COL[b] - COL[a] + 14, h, label })
const TOP = (a: number, b: number, label: string) => box(a, b, 16, 47.5, label)
const BOTTOM = (a: number, b: number, label: string) => box(a, b, 65, 55, label)

const oscControls = (n: 1 | 2, c: number): Control[] => [
  TOP(c, c + 2, `VCO ${n}`),
  knob(`vco${n}`, COL[c], R1, 'FREQ'),
  knob(`s${n}1`, COL[c + 1], R1, 'SUB 1 ÷'),
  knob(`s${n}2`, COL[c + 2], R1, 'SUB 2 ÷'),
  knob(`l${n}`, COL[c], R2, 'VCO LVL'),
  knob(`l${n}1`, COL[c + 1], R2, 'SUB 1 LVL'),
  knob(`l${n}2`, COL[c + 2], R2, 'SUB 2 LVL'),
]
const ASSIGN_X = 80
const ASSIGN_DX = 11

/** Subharmonic polyrhythm system in the Subharmonicon tradition. Two VCOs,
 *  each with two subharmonics (the VCO divided by 1–16, phase-locked to it),
 *  into a ladder filter and VCA with AD envelopes. Two 4-step sequencers
 *  move the VCOs and/or their sub divisions; four rhythm generators (the
 *  tempo divided by 1–16) clock them, combined OR / XOR, so the steps fall
 *  in polyrhythms. Quantized to 12 or 8 equal or just steps. */
export const undertone: ModuleSpec = {
  type: 'undertone',
  title: 'UNDERTONE',
  name: 'UNDERTONE Subharmonic System',
  tagline: 'Two VCOs with subharmonics, two 4-step sequencers clocked by four polyrhythm dividers',
  category: 'Systems',
  hp: 60,
  panel: SLATE,
  inputs,
  outputs,
  params,
  leds: UTL.none + 1,
  controls: [
    ...oscControls(1, 0),
    ...oscControls(2, 3),
    TOP(6, 6, 'WAVE'),
    sw('wave1', COL[6], R1),
    sw('wave2', COL[6], R2),
    { kind: 'text', text: '1', x: COL[6] - 5.2, y: R1 + 0.7, size: 2.2 },
    { kind: 'text', text: '2', x: COL[6] - 5.2, y: R2 + 0.7, size: 2.2 },
    TOP(7, 9, 'FILTER'),
    knob('cutoff', COL[7], R1),
    knob('res', COL[8], R1),
    knob('vcfeg', COL[9], R1, 'EG AMT'),
    knob('vcfa', COL[7], R2, 'ATTACK'),
    knob('vcfd', COL[8], R2, 'DECAY'),
    TOP(10, 11, 'AMP'),
    knob('vcaa', COL[10], R1, 'ATTACK'),
    knob('vcad', COL[11], R1, 'DECAY'),
    sw('vcamode', COL[10], R2),
    knob('vol', COL[11], R2),
    TOP(12, 14, 'PITCH'),
    knob('quant', COL[12], R1),
    sw('range', COL[13], R1),
    { kind: 'text', text: 'SEQ RANGE', x: COL[13], y: R1 + 13.5, size: 1.9 },
    knob('glide', COL[14], R1),

    BOTTOM(0, 6, 'SEQUENCERS'),
    ...Array.from({ length: UT_STEPS }, (_, i): Control[] => [
      { kind: 'led', index: UTL.seq1 + i, x: COL[i], y: 70, color: '#4fc6d6' },
      knob(`a${i}`, COL[i], R3, `1·${i + 1}`),
      { kind: 'led', index: UTL.seq2 + i, x: COL[i], y: 92, color: '#4fc6d6' },
      knob(`b${i}`, COL[i], R4, `2·${i + 1}`),
    ]).flat(),
    ...['OSC', 'SUB 1', 'SUB 2'].map((t, i): Control => ({ kind: 'text', text: t, x: ASSIGN_X + i * ASSIGN_DX, y: 80.5, size: 1.6 })),
    {
      kind: 'steps',
      x: ASSIGN_X,
      y: 87,
      dx: ASSIGN_DX,
      dy: 8,
      cols: 3,
      rows: [
        { label: 'SEQ 1', p: ['as1'] },
        { label: 'SEQ 2', p: ['as2'] },
      ],
      stepLed: UTL.none,
    },
    { kind: 'text', text: 'ASSIGN', x: ASSIGN_X + ASSIGN_DX, y: 108, size: 1.6 },

    BOTTOM(7, 11, 'RHYTHMS'),
    ...Array.from({ length: UT_RHYTHMS }, (_, i): Control[] => [
      { kind: 'led', index: UTL.rhythm + i, x: COL[8 + i], y: 70, color: '#ffb347' },
      knob(`r${i + 1}`, COL[8 + i], R3, `RHYTHM ${i + 1}`),
    ]).flat(),
    {
      kind: 'steps',
      x: COL[8],
      y: 97,
      dx: 15.5,
      dy: 8,
      cols: UT_RHYTHMS,
      rows: [
        { label: 'SEQ 1', p: ['rt1'] },
        { label: 'SEQ 2', p: ['rt2'] },
      ],
      stepLed: UTL.none,
    },
    { kind: 'text', text: 'EACH DIVIDES THE TEMPO · LIT = CLOCKS THAT SEQUENCER', x: COL[8] + 23.25, y: 116, size: 1.4 },

    BOTTOM(12, 14, 'CLOCK'),
    sw('logic', COL[12], R3),
    knob('tempo', COL[13], R3),
    { kind: 'led', index: UTL.tempo, x: COL[14], y: R3, color: '#ffb347' },
    sw('run', COL[12], R4),
    { kind: 'button', name: 'reset', x: COL[13], y: R4, label: 'RESET' },

    { kind: 'section', x: 239, y: 16, w: 62, h: 105, label: 'PATCH BAY' },
    { kind: 'text', text: 'INPUTS', x: 270, y: 21.5, size: 1.8 },
    ...inputs.map((j, i): Control => ({ kind: 'in', jack: j.id, x: PATCH_X[i % 5], y: IN_ROWS[Math.floor(i / 5)] })),
    { kind: 'text', text: 'OUTPUTS', x: 270, y: 69, size: 1.8 },
    ...outputs.map((j, i): Control => ({ kind: 'out', jack: j.id, x: PATCH_X[i % 5], y: OUT_ROWS[Math.floor(i / 5)] })),
    { kind: 'text', text: 'PATCHING AN INPUT', x: 281, y: 116.5, size: 1.4 },
    { kind: 'text', text: 'BREAKS ITS NORMAL', x: 281, y: 118.8, size: 1.4 },
  ],
}
