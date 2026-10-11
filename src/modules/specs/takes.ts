import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLUE } from './panels'

export const TK_TAKES = 4
export const TK_MAX_BARS = 16
/** The longest a take can be (s): 16 bars at 120 BPM. */
export const TK_MAX_SECONDS = 34
/** States on the LED channel. */
export const TK_STATE = { idle: 0, armed: 1, recording: 2 } as const
/** LEDs: state, the take being recorded, the 16th within the passage (−1
 *  stopped), which takes hold audio (bits), then each take's loudness per
 *  bar (take × bar, 0..1). */
export const TKL = { state: 0, take: 1, pos: 2, has: 3, peak0: 4 } as const

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'tempo', label: 'TEMPO', min: 40, max: 220, def: 120, unit: 'bpm' },
  { id: 'bars', label: 'BARS', min: 1, max: TK_MAX_BARS, def: 4, stepped: true },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'mon', label: 'MONITOR', min: 0, max: 1, def: 1, stepped: true, options: ['OFF', 'ON'] },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ...Array.from({ length: TK_MAX_BARS }, (_, b): ParamSpec => ({ id: `c${b}`, label: `BAR ${b + 1} TAKE`, min: -1, max: TK_TAKES - 1, def: 0, stepped: true })),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
  { id: 'rec', label: 'REC' },
]
const outputs: ModuleSpec['outputs'] = [{ id: 'out', label: 'OUT' }]

const HP = 36
const W = HP * HP_MM
const layout = packRows(
  [[knob('tempo'), knob('bars'), knob('level'), sw('mon'), sw('run'), jack('in', 'in'), jack('in', 'clk'), jack('in', 'rst'), jack('in', 'rec'), jack('out', 'out')]],
  { params, inputs, outputs },
  W,
  { gap: 1.4 },
)

/** TAKES: record a passage (BARS long, in time with CLK) as many times as
 *  you like, up to four takes, then build one performance from the best of
 *  them: for each bar, click the take that plays it (a comp). Edits cross
 *  over in a few milliseconds, so the joins don't click. Press REC on the
 *  screen (or a gate at REC): the next pass from the top is recorded into the
 *  first empty take. Right-click a take's name to clear it. Takes are kept
 *  with the rack. MONITOR passes what comes in through to OUT as well. */
export const takes: ModuleSpec = {
  type: 'takes',
  title: 'TAKES',
  name: 'Take Comper',
  tagline: 'Record a passage up to four times, then comp the best bars of each into one performance; in time with the song; kept with the rack',
  category: 'Sampling & Tape',
  hp: HP,
  panel: BLUE,
  inputs,
  outputs,
  params,
  leds: TKL.peak0 + TK_TAKES * TK_MAX_BARS,
  controls: [{ kind: 'surface', name: 'takes', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
