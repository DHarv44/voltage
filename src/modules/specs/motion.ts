import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLUSH } from './panels'

export const MOTION_LANES = 4
/** Points per recorded loop (played back with straight lines between them). */
export const MOTION_POINTS = 64
/** Stored point values run 0..MOTION_RES (integers, so they persist exactly). */
export const MOTION_RES = 1000
export const MOTION_BARS = ['1', '2', '4', '8']
export const LANE_NAMES = ['A', 'B', 'C', 'D']
/** Lane states on the LED channel. */
export const LANE = { empty: 0, armed: 1, recording: 2, playing: 3 } as const
/** LEDs: each lane's value (0..1), each lane's state, the loop position (0..1). */
export const MOTL = { value: 0, state: MOTION_LANES, head: MOTION_LANES * 2 } as const

export const pointId = (lane: number, i: number) => `pt${lane}_${i}`
export const hasId = (lane: number) => `has${lane}`

const params: ParamSpec[] = [
  { id: 'tempo', label: 'TEMPO', min: 40, max: 240, def: 120, unit: 'bpm' },
  { id: 'bars', label: 'BARS', min: 0, max: MOTION_BARS.length - 1, def: 1, stepped: true, options: MOTION_BARS },
  { id: 'smooth', label: 'SMOOTH', min: 0, max: 1, def: 0.3, unit: '%' },
  ...Array.from({ length: MOTION_LANES }, (_, l): ParamSpec => ({ id: hasId(l), label: `${LANE_NAMES[l]} RECORDED`, min: 0, max: 1, def: 0, stepped: true })),
  ...Array.from({ length: MOTION_LANES }, (_, l) =>
    Array.from({ length: MOTION_POINTS }, (_, i): ParamSpec => ({ id: pointId(l, i), label: `${LANE_NAMES[l]} POINT ${i + 1}`, min: 0, max: MOTION_RES, def: 0, stepped: true })),
  ).flat(),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RESET' },
]
const outputs: ModuleSpec['outputs'] = LANE_NAMES.map((n, l) => ({ id: `cv${l}`, label: n }))

const HP = 20
const W = HP * HP_MM
const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'M' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const layout = packRows(
  [
    [knob('tempo'), knob('bars'), knob('smooth'), null],
    [jack('in', 'clk'), jack('in', 'rst'), null, null],
    outputs.map((j) => jack('out', j.id)),
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 2.6 },
)

/** Motion recorder: four lanes that each learn one knob's movement and loop it
 *  in time. Press a lane's REC, then turn any knob in the rack: the first one
 *  you move becomes that lane's, and one loop (BARS long) of your hand is
 *  recorded from there, then played back over and over. Right-click a lane to
 *  clear it. Each lane is also a 0–10 V CV out. Tempo from CLK (16ths, as from
 *  CLOCK's ×4) or its own TEMPO knob; SMOOTH glides between the points. */
export const motion: ModuleSpec = {
  type: 'motion',
  title: 'MOTION',
  name: 'Motion Recorder',
  tagline: 'Record any knob’s movement and loop it in time: four lanes, 1–8 bars, each also a CV out',
  category: 'Performance',
  hp: HP,
  panel: BLUSH,
  inputs,
  outputs,
  params,
  leds: MOTION_LANES * 2 + 1,
  controls: [{ kind: 'surface', name: 'motion', x: 5, y: 16, w: W - 10, h: layout.top - 16 - 4 }, ...layout.controls],
}
