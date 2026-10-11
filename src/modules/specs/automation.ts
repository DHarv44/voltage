import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLUSH } from './panels'

export const AU_LANES = 4
/** Points a lane can hold. */
export const AU_POINTS = 32
export const AU_MAX_BARS = 128
/** Point values run 0..AU_RES (integers, so they persist exactly). */
export const AU_RES = 1000
export const AU_NAMES = ['A', 'B', 'C', 'D']
/** LEDs: where the song is (16ths, −1 stopped), then each lane's value (0..1). */
export const AUL = { pos: 0, value0: 1 } as const

/** Lane l's point i: when (16ths from the top; −1 = no point) and how high. */
export const auT = (l: number, i: number) => `t${l}_${i}`
export const auV = (l: number, i: number) => `v${l}_${i}`

/** The factory lanes: A opens a filter over the first 16 bars and sweeps it
 *  shut for a breakdown; the others are flat until you draw them. */
const FACTORY: [number, number][][] = [[[0, 150], [16 * 16, 800], [24 * 16, 800], [28 * 16, 300], [32 * 16 - 1, 900]], [], [], []]

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'tempo', label: 'TEMPO', min: 40, max: 220, def: 120, unit: 'bpm' },
  { id: 'bars', label: 'BARS', min: 1, max: AU_MAX_BARS, def: 32, stepped: true },
  { id: 'loop', label: 'LOOP', min: 0, max: 1, def: 1, stepped: true, options: ['HOLD', 'LOOP'] },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ...Array.from({ length: AU_LANES }, (_, l): ParamSpec => ({ id: `rng${l}`, label: `${AU_NAMES[l]} RANGE`, min: 0, max: 1, def: 0, stepped: true, options: ['0–10V', '±5V'] })),
  ...Array.from({ length: AU_LANES }, (_, l) =>
    Array.from({ length: AU_POINTS }, (_, i): ParamSpec[] => {
      const f = FACTORY[l][i]
      return [
        { id: auT(l, i), label: `${AU_NAMES[l]} POINT ${i + 1} TIME`, min: -1, max: AU_MAX_BARS * 16 - 1, def: f ? f[0] : -1, stepped: true },
        { id: auV(l, i), label: `${AU_NAMES[l]} POINT ${i + 1} VALUE`, min: 0, max: AU_RES, def: f ? f[1] : 500, stepped: true },
      ]
    }).flat(),
  ).flat(),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
]
const outputs: ModuleSpec['outputs'] = AU_NAMES.map((n, l) => ({ id: `cv${l}`, label: n }))

const HP = 40
const W = HP * HP_MM
const layout = packRows(
  [
    [knob('tempo'), knob('bars'), sw('loop'), sw('run'), ...Array.from({ length: AU_LANES }, (_, l) => sw(`rng${l}`))],
    [jack('in', 'clk'), jack('in', 'rst'), null, null, ...outputs.map((j) => jack('out', j.id))],
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 1.4 },
)

/** AUTOMATION: four lanes drawn across the whole song (up to 128 bars), each
 *  a CV out gliding in straight lines from point to point: the filter that
 *  opens over the first verse, the reverb that swells into the breakdown,
 *  the level that dips for a bridge. It counts 16ths from RST, so on
 *  ARRANGER XL's CLK and RST it follows the song exactly (and its moves are
 *  in a bounce, being voltages, not knob turns). Click a lane to add a point,
 *  drag one to move it, right-click to delete. */
export const automation: ModuleSpec = {
  type: 'automation',
  title: 'AUTOMATION',
  name: 'Song Automation',
  tagline: 'Four CV lanes drawn across the whole song (up to 128 bars), point to point; follows ARRANGER XL’s clock; filter sweeps, swells and fades over a song',
  category: 'Performance',
  hp: HP,
  panel: BLUSH,
  inputs,
  outputs,
  params,
  leds: 1 + AU_LANES,
  controls: [{ kind: 'surface', name: 'automation', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
