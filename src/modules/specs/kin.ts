import type { Control, ModuleSpec, ParamSpec } from '../types'
import { BLACK } from './panels'

export const KIN_STEPS = 8
/** LED layout: one per step, then the tempo blink. */
export const KINL = { step: 0, tempo: KIN_STEPS } as const

/** A knob grid: twelve columns across the voice, two rows. */
const COL = Array.from({ length: 12 }, (_, i) => 10 + 15.5 * i)
const R1 = 31
const R2 = 53
/** The steps sit under the last eight columns. */
const STEP_X = COL.slice(4)
const PITCH_Y = 80
const VEL_Y = 96
const PATCH_X = [201.5, 212.5, 223.5, 234.5]
const IN_ROWS = [31, 43.5, 56, 68.5]
const OUT_ROWS = [90, 106]

/** A techno-ish default: a falling tom line with ghost hits between. */
const PITCHES = [0, -0.35, 0.2, -0.35, 0.55, -0.35, 0.1, 0.8]
const VELS = [1, 0.25, 0.6, 0.2, 0.9, 0.3, 0.7, 0.45]

const inputs = [
  { id: 'trig', label: 'TRIG' },
  { id: 'vcacv', label: 'VCA CV' },
  { id: 'vel', label: 'VEL' },
  { id: 'vcadec', label: 'VCA DEC' },
  { id: 'ext', label: 'EXT IN' },
  { id: 'vcfdec', label: 'VCF DEC' },
  { id: 'noise', label: 'NOISE' },
  { id: 'vcodec', label: 'VCO DEC' },
  { id: 'vcfmod', label: 'VCF MOD' },
  { id: 'vco1', label: 'VCO1 CV' },
  { id: 'fm', label: 'FM AMT' },
  { id: 'vco2', label: 'VCO2 CV' },
  { id: 'tempo', label: 'TEMPO' },
  { id: 'run', label: 'RUN' },
  { id: 'adv', label: 'ADV' },
  { id: 'rst', label: 'RST' },
]
const outputs = [
  { id: 'vca', label: 'VCA' },
  { id: 'vcfeg', label: 'VCF EG' },
  { id: 'vcoeg', label: 'VCO EG' },
  { id: 'vco1', label: 'VCO 1' },
  { id: 'vco2', label: 'VCO 2' },
  { id: 'trig', label: 'TRIG' },
  { id: 'vel', label: 'VEL' },
  { id: 'pitch', label: 'PITCH' },
]

const decay = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0.005, max: 5, def, curve: 'exp', unit: 's' })
const freq = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 10, max: 4000, def, curve: 'exp', unit: 'Hz' })
const amt = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: -1, max: 1, def, unit: '%' })
const level = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0, max: 1, def, unit: '%' })
const toggle = (id: string, label: string, options: string[], def = 0): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })

const params: ParamSpec[] = [
  decay('vcodec', 'VCO DECAY', 0.12),
  toggle('seqmod', 'SEQ PITCH', ['VCO 2', 'OFF', 'VCO 1+2'], 2),
  amt('vco1eg', 'VCO1 EG', 0.35),
  freq('vco1', 'VCO1 FREQ', 55),
  toggle('wave1', 'VCO1 WAVE', ['TRI', 'SQR']),
  level('lvl1', 'VCO1 LEVEL', 0.8),
  level('noise', 'NOISE', 0.15),
  { id: 'cutoff', label: 'CUTOFF', min: 20, max: 18000, def: 900, curve: 'exp', unit: 'Hz' },
  { id: 'res', label: 'RESONANCE', min: 0, max: 1.1, def: 0.3, unit: '%' },
  toggle('vcfmode', 'VCF MODE', ['LP', 'HP']),
  decay('vcadec', 'VCA DECAY', 0.3),
  level('vol', 'VOLUME', 0.6),
  level('fm', '1→2 FM', 0.1),
  toggle('sync', 'SYNC', ['OFF', 'SYNC']),
  amt('vco2eg', 'VCO2 EG', 0.2),
  freq('vco2', 'VCO2 FREQ', 160),
  toggle('wave2', 'VCO2 WAVE', ['TRI', 'SQR'], 1),
  level('lvl2', 'VCO2 LEVEL', 0.35),
  level('noisemod', 'NOISE MOD', 0),
  amt('vcfeg', 'VCF EG', 0.45),
  decay('vcfdec', 'VCF DECAY', 0.2),
  toggle('vcaatt', 'VCA ATTACK', ['FAST', 'SLOW']),
  { id: 'tempo', label: 'TEMPO', min: 20, max: 300, def: 112, curve: 'exp', unit: 'bpm' },
  toggle('run', 'RUN', ['STOP', 'RUN']),
  ...PITCHES.map((def, i): ParamSpec => ({ id: `p${i}`, label: `PITCH ${i + 1}`, min: -1, max: 1, def, unit: 'oct' })),
  ...VELS.map((def, i): ParamSpec => ({ id: `v${i}`, label: `VELOCITY ${i + 1}`, min: 0, max: 1, def, unit: '%' })),
  toggle('quant', 'STEP PITCH', ['FREE', 'SEMITONES']),
]

/** Row one and row two of the voice, column by column (null = empty). */
const ROW1 = ['vcodec', 'seqmod', 'vco1eg', 'vco1', 'wave1', 'lvl1', 'noise', 'cutoff', 'res', 'vcfmode', 'vcadec', 'vol']
const ROW2 = ['fm', 'sync', 'vco2eg', 'vco2', 'wave2', 'lvl2', 'noisemod', 'vcfeg', 'vcfdec', null, 'vcaatt', null]
const place = (id: string | null, x: number, y: number): Control[] => {
  if (!id) return []
  const ps = params.find((p) => p.id === id)!
  return [ps.stepped ? { kind: 'switch', param: id, x, y } : { kind: 'knob', param: id, x, y }]
}
/** A section boxing columns a..b of the voice. */
const section = (a: number, b: number, label: string): Control => ({ kind: 'section', x: COL[a] - 7, y: 16, w: COL[b] - COL[a] + 14, h: 47.5, label })

/** Percussion semi-modular in the DFAM tradition: two VCOs (pitch-swept by
 *  their own decay envelope, 1→2 FM, hard sync), noise, a ladder filter and
 *  a VCA, each with a decay envelope, struck by an 8-step pitch / velocity
 *  sequencer. Every step strikes; velocity sets how hard (0 = a rest). The
 *  patch bay's inputs break their normals, so it clocks, and is clocked by,
 *  the rest of the rack (UNDERTONE is its natural partner). */
export const kin: ModuleSpec = {
  type: 'kin',
  title: 'KIN-8',
  name: 'KIN-8 Percussion System',
  tagline: 'Two VCOs, noise, ladder, three decays and an 8-step pitch/velocity sequencer; every step strikes',
  category: 'Systems',
  hp: 48,
  panel: BLACK,
  inputs,
  outputs,
  params,
  leds: KIN_STEPS + 1,
  settings: ['quant'],
  controls: [
    section(0, 5, 'OSCILLATORS'),
    section(6, 9, 'NOISE · FILTER'),
    section(10, 11, 'AMP'),
    { kind: 'text', text: 'SEQ PITCH', x: COL[1], y: 21.6, size: 1.6 },
    ...ROW1.flatMap((id, i) => place(id, COL[i], R1)),
    ...ROW2.flatMap((id, i) => place(id, COL[i], R2)),

    { kind: 'section', x: 3, y: 65, w: 185.25, h: 55, label: 'SEQUENCER' },
    { kind: 'switch', param: 'run', x: COL[0], y: 82 },
    { kind: 'knob', param: 'tempo', x: COL[1], y: 82 },
    { kind: 'led', index: KINL.tempo, x: COL[2], y: 82, color: '#ff6a1a' },
    { kind: 'button', name: 'trig', x: COL[0], y: 103, label: 'TRIG' },
    { kind: 'button', name: 'adv', x: COL[1], y: 103, label: 'ADV' },
    { kind: 'text', text: 'PITCH', x: 59.5, y: PITCH_Y + 0.7, size: 1.9 },
    { kind: 'text', text: 'VELOCITY', x: 59.5, y: VEL_Y + 0.7, size: 1.9 },
    ...STEP_X.flatMap((x, i): Control[] => [
      { kind: 'led', index: KINL.step + i, x, y: 70.5, color: '#ff6a1a' },
      { kind: 'knob', param: `p${i}`, x, y: PITCH_Y, size: 'S', label: '' },
      { kind: 'knob', param: `v${i}`, x, y: VEL_Y, size: 'S', label: '' },
      { kind: 'text', text: String(i + 1), x, y: 107, size: 1.9 },
    ]),
    { kind: 'text', text: 'EVERY STEP STRIKES · VELOCITY 0 IS A REST', x: 126.25, y: 115.5, size: 1.6 },

    { kind: 'section', x: 195, y: 16, w: 45.5, h: 104, label: 'PATCH BAY' },
    { kind: 'text', text: 'INPUTS', x: 218, y: 21.5, size: 1.8 },
    ...inputs.map((j, i): Control => ({ kind: 'in', jack: j.id, x: PATCH_X[i % 4], y: IN_ROWS[Math.floor(i / 4)] })),
    { kind: 'text', text: 'OUTPUTS', x: 218, y: 77.5, size: 1.8 },
    ...outputs.map((j, i): Control => ({ kind: 'out', jack: j.id, x: PATCH_X[i % 4], y: OUT_ROWS[Math.floor(i / 4)] })),
    { kind: 'text', text: 'PATCHING AN INPUT BREAKS ITS NORMAL', x: 218, y: 116, size: 1.4 },
  ],
}
