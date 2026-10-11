import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { ERA_NAMES, SOUND_NAMES } from './sampling'
import { BLACK } from './panels'
import { KEY_NAMES } from './tune'

export const LP_STEPS = 16
export const LP_ROWS = 8
export const LP_SCALES = ['MAJOR', 'MINOR', 'DORIAN', 'PENTA']
/** Each scale's eight rows, in semitones up from KEY. */
export const LP_SCALE_STEPS = [
  [0, 2, 4, 5, 7, 9, 11, 12],
  [0, 2, 3, 5, 7, 8, 10, 12],
  [0, 2, 3, 5, 7, 9, 10, 12],
  [0, 2, 4, 7, 9, 12, 14, 16],
]
/** LEDs: the step playing (−1), recording (0/1), how full the recording is (0..1). */
export const LPL = { step: 0, rec: 1, fill: 2 } as const

/** The factory pattern: an orchestra-hit figure (bit r = row r). */
const FACTORY = [0b1, 0, 0, 0b1, 0, 0, 0b100, 0, 0b10000, 0, 0, 0b10000, 0, 0b100, 0, 0]

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'sound', label: 'SOUND', min: 0, max: SOUND_NAMES.length, def: 0, stepped: true, options: [...SOUND_NAMES, 'YOURS'] },
  { id: 'era', label: 'ERA', min: 0, max: ERA_NAMES.length - 1, def: 1, stepped: true, options: ERA_NAMES },
  { id: 'tune', label: 'TUNE', min: -12, max: 12, def: 0, stepped: true, unit: 'st' },
  { id: 'cutoff', label: 'FILTER', min: 200, max: 16000, def: 9000, curve: 'exp', unit: 'Hz' },
  { id: 'res', label: 'RESONANCE', min: 0, max: 0.9, def: 0.1, unit: '%' },
  { id: 'att', label: 'ATTACK', min: 0.001, max: 2, def: 0.002, curve: 'exp', unit: 's' },
  { id: 'rel', label: 'RELEASE', min: 0.01, max: 4, def: 0.3, curve: 'exp', unit: 's' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'loop', label: 'LOOP', min: 0, max: 1, def: 1, stepped: true, options: ['ONCE', 'LOOP'] },
  { id: 'tempo', label: 'TEMPO', min: 40, max: 220, def: 104, unit: 'bpm' },
  { id: 'key', label: 'KEY', min: 0, max: 11, def: 0, stepped: true, options: KEY_NAMES },
  { id: 'scale', label: 'SCALE', min: 0, max: LP_SCALES.length - 1, def: 1, stepped: true, options: LP_SCALES },
  { id: 'oct', label: 'OCTAVE', min: -2, max: 1, def: 0, stepped: true },
  { id: 'seq', label: 'SEQUENCE', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ...Array.from({ length: LP_STEPS }, (_, s): ParamSpec => ({ id: `g${s}`, label: `STEP ${s + 1}`, min: 0, max: 2 ** LP_ROWS - 1, def: FACTORY[s], stepped: true })),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
  { id: 'in', label: 'IN' },
  { id: 'rec', label: 'REC' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]

const HP = 48
const W = HP * HP_MM
const layout = packRows(
  [
    [knob('sound'), knob('era'), knob('tune'), knob('cutoff'), knob('res'), knob('att'), knob('rel'), knob('level'), sw('loop')],
    [knob('tempo'), knob('key'), knob('scale'), knob('oct'), sw('seq'), { kind: 'button', name: 'rec', x: 0, y: 0, label: 'REC', led: LPL.rec, ledColor: '#ff3b2f' }, { kind: 'file', slot: 0, x: 0, y: 0, label: 'LOAD' }, null, null],
    [jack('in', 'voct'), jack('in', 'gate'), jack('in', 'clk'), jack('in', 'rst'), jack('in', 'in'), jack('in', 'rec'), null, jack('out', 'l'), jack('out', 'r')],
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 1.6 },
)

/** LIGHTPEN: an early-80s sampling workstation (our own take). Its sounds
 *  (an orchestra hit, a choir, strings, a bell, bass, piano, a shout, a
 *  break, all synthesised here, or your own recorded or loaded) play pitched
 *  across the keys, eight voices, each through its own converter clock that
 *  runs at the pitch played: the 8-bit grain and the aliasing that moves with
 *  the note are the sound of the era. A filter and envelope after, and a
 *  step grid on its green screen (rows are notes of KEY and SCALE; lit cells
 *  in a row run on as one long note). Plays from the keys, a poly cable, or
 *  its own grid. */
export const lightpen: ModuleSpec = {
  type: 'lightpen',
  title: 'LIGHTPEN',
  name: 'Lightpen (Early-80s Sampler)',
  tagline: 'An early-80s sampling workstation: orchestra hits, choirs and your own samples played pitched through 8-bit variable-rate converters, with a step grid on a green screen',
  category: 'Sampling & Tape',
  hp: HP,
  panel: BLACK,
  inputs,
  outputs,
  params,
  leds: 3,
  controls: [{ kind: 'surface', name: 'lightpen', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
