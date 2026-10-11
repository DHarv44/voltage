import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { DRUM } from './panels'

export const JG_STEPS = 16
export const JG_SLICES = 32
export const JG_EFFECTS = ['—', 'ROLL ×2', 'ROLL ×4', 'REVERSE']
/** LEDs: the step playing (−1), each slice's loudness (for the screen), recording. */
export const JGL = { step: 0, slice0: 1, rec: 1 + JG_SLICES } as const

/** The factory edit: the break as it comes, with a roll and a reversed snare. */
const FACTORY_SLICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 14, 4]
const FACTORY_FX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 3]

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'tempo', label: 'TEMPO', min: 80, max: 200, def: 168, unit: 'bpm' },
  { id: 'src', label: 'BREAK BPM', min: 60, max: 200, def: 120, unit: 'bpm' },
  { id: 'mode', label: 'STRETCH', min: 0, max: 1, def: 1, stepped: true, options: ['REPITCH', 'CYCLIC'] },
  { id: 'cycle', label: 'CYCLE', min: 0.005, max: 0.12, def: 0.03, curve: 'exp', unit: 's' },
  { id: 'pitch', label: 'PITCH', min: -12, max: 12, def: 0, unit: 'st' },
  { id: 'crunch', label: 'CRUNCH', min: 0, max: 1, def: 0.4, unit: '%' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ...Array.from({ length: JG_STEPS }, (_, i): ParamSpec[] => [
    { id: `s${i}`, label: `STEP ${i + 1} SLICE`, min: -1, max: JG_SLICES - 1, def: FACTORY_SLICES[i], stepped: true },
    { id: `x${i}`, label: `STEP ${i + 1} EFFECT`, min: 0, max: JG_EFFECTS.length - 1, def: FACTORY_FX[i], stepped: true, options: JG_EFFECTS },
  ]).flat(),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
  { id: 'in', label: 'IN' },
  { id: 'rec', label: 'REC' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'out', label: 'OUT' },
  { id: 'trig', label: 'TRIG' },
]
const HP = 32
const W = HP * HP_MM
const layout = packRows(
  [
    [knob('tempo'), knob('src'), sw('mode'), knob('cycle'), knob('pitch'), knob('crunch'), knob('level'), sw('run')],
    [{ kind: 'button', name: 'edit', x: 0, y: 0, label: 'EDIT' }, { kind: 'button', name: 'rec', x: 0, y: 0, label: 'REC', led: JGL.rec, ledColor: '#ff3b2f' }, { kind: 'file', slot: 0, x: 0, y: 0, label: 'LOAD' }, jack('in', 'clk'), jack('in', 'rst'), jack('in', 'in'), jack('in', 'rec'), jack('out', 'out'), jack('out', 'trig')],
  ],
  { params, inputs, outputs },
  W,
  { gap: 1.6 },
)

/** JUNGLE: a break, cut into 16ths and played back in a new order, faster:
 *  the jungle trick. Each of the sixteen steps picks a slice (and can roll it
 *  ×2 or ×4, or play it backwards). STRETCH chooses how it gets to TEMPO:
 *  REPITCH plays it faster and higher, as everyone did at first; CYCLIC is
 *  the 90s rack sampler's time-stretch, the break kept at pitch by playing
 *  little CYCLE-long pieces of it over and over or skipping them, which
 *  leaves the buzz and stutter that became part of the sound. CRUNCH is
 *  that sampler's 12-bit converter. EDIT writes a new edit for you. The
 *  factory break is synthesised here; REC or LOAD your own loop (BREAK BPM
 *  is its tempo). */
export const jungle: ModuleSpec = {
  type: 'jungle',
  title: 'JUNGLE',
  name: 'Jungle (Break Mangler)',
  tagline: 'A break cut into 16ths and replayed in a new order with rolls and reverses, pushed to tempo by repitching or the 90s rack sampler’s cyclic time-stretch (its buzz and all)',
  category: 'Sampling & Tape',
  hp: HP,
  panel: DRUM,
  inputs,
  outputs,
  params,
  leds: JGL.rec + 1,
  controls: [{ kind: 'surface', name: 'jungle', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
