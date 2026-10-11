import type { Control, ModuleSpec, ParamSpec } from '../types'
import { BLACK } from './panels'

export const MN_RANGES = ['LO', "32'", "16'", "8'", "4'", "2'"]
/** Octaves from 8' (LO is an LFO for oscillator 3). */
export const MN_RANGE_OCT = [-7, -2, -1, 0, 1, 2]
export const MN_WAVES = ['TRI', 'SHARK', 'SAW', 'SQUARE', 'WIDE', 'NARROW']
export const MN_KBD = ['OFF', '1/3', '2/3', 'FULL']
/** LEDs: oscillator 3 (as a modulation source), the loudness contour. */
export const MNL = { osc3: 0, loud: 1 } as const

const COL = Array.from({ length: 10 }, (_, i) => 10 + 15.5 * i)
const ROWS = [31, 54, 77, 100]
const PATCH_X = [170.5, 181.5, 192.5, 203.5]
const IN_ROWS = [31, 43.5]
const OUT_ROWS = [80, 96]

const inputs = [
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'ext', label: 'EXT IN' },
  { id: 'cutoff', label: 'CUTOFF' },
  { id: 'loud', label: 'LOUD' },
  { id: 'mod', label: 'MOD IN' },
  { id: 'pitch', label: 'OSC CV' },
]
const outputs = [
  { id: 'out', label: 'OUT' },
  { id: 'mix', label: 'MIXER' },
  { id: 'osc3', label: 'OSC 3' },
  { id: 'fenv', label: 'F. CONT' },
  { id: 'lenv', label: 'L. CONT' },
  { id: 'kcv', label: 'KEY CV' },
  { id: 'kgate', label: 'GATE' },
]

const level = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0, max: 1, def, unit: '%' })
const time = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0.001, max: 10, def, curve: 'exp', unit: 's' })
const pick = (id: string, label: string, options: string[], def: number): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })

const params: ParamSpec[] = [
  // controllers
  { id: 'tune', label: 'TUNE', min: -1, max: 1, def: 0, unit: 'st' },
  time('glide', 'GLIDE', 0.001),
  level('modmix', 'MOD MIX', 0),
  level('modamt', 'MOD AMOUNT', 0),
  pick('oscmod', 'OSC MOD', ['OFF', 'ON'], 0),
  pick('osc3ctl', 'OSC 3 KEYS', ['FREE', 'KEYS'], 1),
  // oscillator bank
  pick('range1', 'RANGE 1', MN_RANGES, 2),
  pick('wave1', 'WAVE 1', MN_WAVES, 2),
  pick('range2', 'RANGE 2', MN_RANGES, 2),
  { id: 'freq2', label: 'FREQ 2', min: -7, max: 7, def: 0.08, unit: 'st' },
  pick('wave2', 'WAVE 2', MN_WAVES, 2),
  pick('range3', 'RANGE 3', MN_RANGES, 1),
  { id: 'freq3', label: 'FREQ 3', min: -7, max: 7, def: -0.05, unit: 'st' },
  pick('wave3', 'WAVE 3', MN_WAVES, 3),
  // mixer
  level('lvl1', 'OSC 1', 0.8),
  level('lvl2', 'OSC 2', 0.65),
  level('lvl3', 'OSC 3', 0.45),
  level('ext', 'EXT · FEEDBACK', 0),
  level('noise', 'NOISE', 0),
  pick('color', 'NOISE COLOR', ['WHITE', 'PINK'], 0),
  // modifiers
  { id: 'cutoff', label: 'CUTOFF', min: 20, max: 16000, def: 420, curve: 'exp', unit: 'Hz' },
  { id: 'emph', label: 'EMPHASIS', min: 0, max: 1.1, def: 0.35, unit: '%' },
  level('contour', 'CONTOUR', 0.55),
  time('fa', 'F. ATTACK', 0.004),
  time('fd', 'F. DECAY', 0.35),
  level('fs', 'F. SUSTAIN', 0.25),
  time('la', 'L. ATTACK', 0.003),
  time('ld', 'L. DECAY', 0.6),
  level('ls', 'L. SUSTAIN', 0.75),
  pick('kbd', 'KEYBOARD', MN_KBD, 2),
  pick('filtmod', 'FILTER MOD', ['OFF', 'ON'], 0),
  pick('decay', 'DECAY', ['OFF', 'ON'], 1),
  level('vol', 'VOLUME', 0.7),
]

const place = (id: string | null, x: number, y: number): Control[] => {
  if (!id) return []
  const ps = params.find((p) => p.id === id)!
  const sw = ps.stepped && (ps.options?.length ?? 9) <= 3
  return [sw ? { kind: 'switch', param: id, x, y } : { kind: 'knob', param: id, x, y }]
}
/** Column by column, the four rows (null = empty). */
const GRID: (string | null)[][] = [
  ['tune', 'glide', 'modmix', 'modamt'],
  ['range1', 'range2', 'range3', 'oscmod'],
  [null, 'freq2', 'freq3', 'osc3ctl'],
  ['wave1', 'wave2', 'wave3', null],
  ['lvl1', 'lvl2', 'lvl3', null],
  ['ext', 'noise', 'color', null],
  ['cutoff', 'fa', 'la', 'kbd'],
  ['emph', 'fd', 'ld', 'filtmod'],
  ['contour', 'fs', 'ls', 'decay'],
  ['vol', null, null, null],
]
const box = (a: number, b: number, label: string): Control => ({ kind: 'section', x: COL[a] - 7, y: 16, w: COL[b] - COL[a] + 14, h: 104, label })

/** A three-oscillator mono synth in the Model D tradition (our own panel and
 *  sound): three drifting oscillators (the third an LFO in LO, or free of
 *  the keys), a mixer that overdrives the ladder filter, EXT normalled to the
 *  synth's own output (the famous feedback trick: turn it up for grit),
 *  filter and loudness contours (attack, decay, sustain; DECAY on lets the
 *  release follow the decay), keyboard tracking, and the modulation mix of
 *  oscillator 3 and noise onto the oscillators and the filter. */
export const monarch: ModuleSpec = {
  type: 'monarch',
  title: 'MONARCH',
  name: 'MONARCH 3-Oscillator Mono',
  tagline: 'Three oscillators, a mixer with the feedback trick, ladder filter and two contours: the fat mono bass and lead',
  category: 'Systems',
  hp: 44,
  panel: BLACK,
  inputs,
  outputs,
  params,
  leds: MNL.loud + 1,
  controls: [
    box(0, 0, 'CONTROL'),
    box(1, 3, 'OSCILLATOR BANK'),
    box(4, 5, 'MIXER'),
    box(6, 8, 'MODIFIERS'),
    box(9, 9, 'OUT'),
    ...GRID.flatMap((col, c) => col.flatMap((id, r) => place(id, COL[c], ROWS[r]))),
    { kind: 'text', text: 'FILTER', x: COL[7], y: ROWS[0] - 10.4, size: 1.5 },
    { kind: 'text', text: 'FILTER CONTOUR', x: COL[7], y: ROWS[1] - 10.4, size: 1.5 },
    { kind: 'text', text: 'LOUDNESS CONTOUR', x: COL[7], y: ROWS[2] - 10.4, size: 1.5 },
    { kind: 'led', index: MNL.osc3, x: COL[3], y: ROWS[3], color: '#ff6a1a' },
    { kind: 'led', index: MNL.loud, x: COL[9], y: ROWS[1], color: '#ffb347' },

    { kind: 'section', x: 164, y: 16, w: 45.5, h: 104, label: 'JACKS' },
    { kind: 'text', text: 'INPUTS', x: 187, y: 21.5, size: 1.8 },
    ...inputs.map((j, i): Control => ({ kind: 'in', jack: j.id, x: PATCH_X[i % 4], y: IN_ROWS[Math.floor(i / 4)] })),
    { kind: 'text', text: 'OUTPUTS', x: 187, y: 67.5, size: 1.8 },
    ...outputs.map((j, i): Control => ({ kind: 'out', jack: j.id, x: PATCH_X[i % 4], y: OUT_ROWS[Math.floor(i / 4)] })),
    { kind: 'text', text: 'EXT IN EMPTY = FEEDBACK', x: 187, y: 58, size: 1.4 },
  ],
}
