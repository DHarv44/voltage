import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { SAND } from './panels'

export const CD_SEGMENTS = 16
export const CD_MAX_BARS = 64
/** LEDs: the segment playing (−1 stopped), the bar within it, the beat within
 *  the bar, the tempo now (BPM). */
export const CDL = { seg: 0, bar: 1, beat: 2, bpm: 3 } as const

/** The factory map: [bars, from BPM, to BPM (0 = steady), beats a bar]:
 *  a steady start, an accelerando, a waltz, and a ritardando to finish. */
const FACTORY: [number, number, number, number][] = [
  [4, 92, 0, 4],
  [4, 92, 124, 4],
  [4, 124, 0, 4],
  [4, 124, 0, 3],
  [4, 124, 76, 4],
]

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'len', label: 'SEGMENTS', min: 1, max: CD_SEGMENTS, def: FACTORY.length, stepped: true },
  { id: 'scale', label: 'TEMPO ×', min: 0.5, max: 2, def: 1, curve: 'exp', unit: 'x' },
  { id: 'loop', label: 'LOOP', min: 0, max: 1, def: 1, stepped: true, options: ['ONCE', 'LOOP'] },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ...Array.from({ length: CD_SEGMENTS }, (_, k): ParamSpec[] => {
    const f = FACTORY[k] ?? FACTORY[FACTORY.length - 1]
    const n = k + 1
    return [
      { id: `b${k}`, label: `BARS ${n}`, min: 1, max: CD_MAX_BARS, def: f[0], stepped: true },
      { id: `f${k}`, label: `FROM ${n}`, min: 30, max: 240, def: f[1], stepped: true, unit: 'bpm' },
      { id: `e${k}`, label: `TO ${n}`, min: 0, max: 240, def: f[2], stepped: true, unit: 'bpm' },
      { id: `m${k}`, label: `METER ${n}`, min: 2, max: 7, def: f[3], stepped: true },
    ]
  }).flat(),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'rst', label: 'RST' },
  { id: 'run', label: 'RUN' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'x4', label: '1/16' },
  { id: 'x2', label: '1/8' },
  { id: 'beat', label: 'BEAT' },
  { id: 'bar', label: 'BAR' },
  { id: 'rsto', label: 'RST' },
  { id: 'tempo', label: 'TEMPO' },
  { id: 'end', label: 'END' },
]

const HP = 30
const W = HP * HP_MM
const layout = packRows(
  [
    [knob('len'), knob('scale'), sw('loop'), sw('run'), jack('in', 'rst'), jack('in', 'run'), null],
    outputs.map((j) => jack('out', j.id)),
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 1.4 },
)

/** CONDUCTOR: the rack's clock, with a tempo map. Up to sixteen segments, each
 *  some bars long in its own meter (2 to 7 beats a bar), steady or ramping
 *  from one tempo to another (an accelerando, a ritardando): the whole map
 *  plays through and loops (or stops). Clock everything from its 1/16; BEAT
 *  and BAR follow the meter; TEMPO is the tempo as a voltage (1 V per 100
 *  BPM). TEMPO × scales the whole map. RUN in: high plays (patch a gate). */
export const conductor: ModuleSpec = {
  type: 'conductor',
  title: 'CONDUCTOR',
  name: 'Conductor (Tempo Map)',
  tagline: 'A clock with a tempo map: up to 16 segments, each its bars, meter (2–7) and a steady or ramping tempo (accelerando, ritardando); 1/16, 1/8, beat, bar and tempo CV out',
  category: 'Sequencers',
  hp: HP,
  panel: SAND,
  inputs,
  outputs,
  params,
  leds: 4,
  controls: [{ kind: 'surface', name: 'conductor', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
