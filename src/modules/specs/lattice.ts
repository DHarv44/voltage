import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLUE } from './panels'
import { QUANT_SCALES } from './shapers'

export const LT_SIZE = 16
export const LT_LAYERS = 8
/** Layers with an output of their own (the rest are heard in L / R). */
export const LT_OUTS = 4
/** SCORE: columns are time, rows pitch (a column plays as a chord).
 *  BOUNCE: one ball per column, dropped from the lit cell; it sounds when it
 *  hits the floor, so the height is its rhythm and the column its note.
 *  RANDOM: the lit dots, played one at a time in no particular order.
 *  HOLD: every lit dot is a held note, struck again each LOOP.
 *  SOLO: the lights are played by hand (row the note, across the velocity).
 *  DRAW: hold and trace a path: it plays as you draw, then loops the trace. */
export const LT_MODES = ['SCORE', 'BOUNCE', 'RANDOM', 'HOLD', 'SOLO', 'DRAW']
export const SCORE = 0
export const BOUNCE = 1
export const RANDOM = 2
export const HOLD = 3
export const SOLO = 4
export const DRAW = 5
/** The longest trace DRAW keeps, in steps. */
export const LT_DRAW = 32
export const drawId = (l: number, i: number) => `dw${l}_${i}`
export const drawLenId = (l: number) => `dwn${l}`
/** A traced cell as stored (0 = a rest). */
export const drawCell = (x: number, y: number) => 1 + x * LT_SIZE + y
export const LT_SOUNDS = ['BELL', 'PLUCK', 'GLASS', 'PAD', 'BASS', 'DRUMS']
export const DRUMS = 5
export const LT_RATES = ['1/4', '1/8', '1/16', '1/32']
/** 16ths per step at each rate. */
export const LT_RATE_STEPS = [4, 2, 1, 0.5]
export const LT_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const LT_COLORS = ['#8fe8ff', '#ffb36b', '#c9a2ff', '#a6ff9a', '#ff8fb8', '#ffe06b', '#6bffd8', '#b0b8ff']

/** LED block per layer: the column playing (HOLD: the loop step; SOLO: a
 *  count of notes played), the dot just played (x, y: RANDOM, SOLO, DRAW),
 *  and each column's ball height (BOUNCE). */
export const LTL = { block: 3 + LT_SIZE, col: 0, rx: 1, ry: 2, balls: 3 } as const
export const LT_LEDS = LTL.block * LT_LAYERS

export const cellId = (l: number, x: number) => `g${l}_${x}`

interface LayerDef {
  mode: number
  snd: number
  oct: number
  rate: number
  vol: number
  swing?: number
  /** Lit cells: column → rows. */
  cells: Record<number, number[]>
  /** DRAW: the trace, [column, row] per step. */
  trace?: [number, number][]
}
/** A trace that climbs and falls back: what a hand drawing a hill plays. */
const HILL: [number, number][] = [[1, 7], [2, 8], [3, 9], [4, 11], [5, 12], [6, 11], [7, 9], [8, 8], [9, 7], [10, 5], [11, 4], [12, 5]]
const EMPTY: LayerDef = { mode: SCORE, snd: 0, oct: 0, rate: 2, vol: 0.5, cells: {} }
/** Something to start from: a bell line, bouncing plucks, a beat, a slow pad,
 *  a drawn glass line (swung); layers 6–8 empty. */
const LAYERS: LayerDef[] = [
  { mode: SCORE, snd: 0, oct: 1, rate: 2, vol: 0.6, cells: { 0: [7], 2: [9], 3: [11], 6: [10], 8: [7], 10: [12], 11: [11], 14: [9] } },
  { mode: BOUNCE, snd: 1, oct: 1, rate: 2, vol: 0.55, cells: { 2: [5], 5: [3], 9: [7], 12: [4] } },
  { mode: SCORE, snd: DRUMS, oct: 0, rate: 2, vol: 0.7, cells: { 0: [0], 2: [3], 4: [0, 1], 6: [3], 8: [0], 10: [3], 12: [0, 1], 14: [3] } },
  { mode: RANDOM, snd: 3, oct: 0, rate: 0, vol: 0.4, cells: { 1: [2], 5: [4], 9: [0], 13: [6] } },
  {
    mode: DRAW,
    snd: 2,
    oct: 0,
    rate: 1,
    vol: 0.3,
    swing: 0.2,
    cells: Object.fromEntries(HILL.map(([x, y]) => [x, [y]])),
    trace: HILL,
  },
  EMPTY,
  EMPTY,
  EMPTY,
]

const opt = (id: string, label: string, options: string[], def: number): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })

const params: ParamSpec[] = [
  opt('layer', 'LAYER', LAYERS.map((_, l) => `${l + 1}`), 0),
  opt('run', 'PLAY', ['STOP', 'PLAY'], 0),
  { id: 'tempo', label: 'TEMPO', min: 40, max: 200, def: 104, unit: 'bpm' },
  opt('scale', 'SCALE', QUANT_SCALES, 2),
  opt('key', 'KEY', LT_KEYS, 9),
  { id: 'master', label: 'MASTER', min: 0, max: 1, def: 0.7, unit: '%' },
  ...LAYERS.flatMap((d, l): ParamSpec[] => [
    opt(`mode${l}`, `L${l + 1} MODE`, LT_MODES, d.mode),
    opt(`snd${l}`, `L${l + 1} SOUND`, LT_SOUNDS, d.snd),
    { id: `oct${l}`, label: `L${l + 1} OCTAVE`, min: -2, max: 2, def: d.oct, stepped: true },
    { id: `len${l}`, label: `L${l + 1} LOOP`, min: 1, max: LT_SIZE, def: LT_SIZE, stepped: true },
    opt(`rate${l}`, `L${l + 1} RATE`, LT_RATES, d.rate),
    { id: `vol${l}`, label: `L${l + 1} VOLUME`, min: 0, max: 1, def: d.vol, unit: '%' },
    { id: `swing${l}`, label: `L${l + 1} SWING`, min: 0, max: 0.5, def: d.swing ?? 0, unit: '%' },
    ...Array.from({ length: LT_SIZE }, (_, x): ParamSpec => ({
      id: cellId(l, x),
      label: `L${l + 1} COLUMN ${x + 1}`,
      min: 0,
      max: 0xffff,
      def: (d.cells[x] ?? []).reduce((m, y) => m | (1 << y), 0),
      stepped: true,
    })),
    { id: drawLenId(l), label: `L${l + 1} TRACE LENGTH`, min: 0, max: LT_DRAW, def: d.trace?.length ?? 0, stepped: true },
    ...Array.from({ length: LT_DRAW }, (_, i): ParamSpec => {
      const c = d.trace?.[i]
      return { id: drawId(l, i), label: `L${l + 1} TRACE ${i + 1}`, min: 0, max: LT_SIZE * LT_SIZE, def: c ? drawCell(c[0], c[1]) : 0, stepped: true }
    }),
  ]),
]

/** The per-layer settings the side of the face edits, for layer `l`. */
export const layerParams = (l: number) => ({ mode: `mode${l}`, snd: `snd${l}`, oct: `oct${l}`, len: `len${l}`, rate: `rate${l}`, vol: `vol${l}`, swing: `swing${l}` })

const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'run', label: 'RUN' },
  { id: 'reset', label: 'RESET' },
]
/** L1–L4: layers 1–4 each on its own (5–8 are only in L / R). */
const outputs: ModuleSpec['outputs'] = [
  ...Array.from({ length: LT_OUTS }, (_, k) => ({ id: `o${k + 1}`, label: `L${k + 1}` })),
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]

const HP = 40
const W = HP * HP_MM
const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const rows = packRows(
  [[...['tempo', 'scale', 'key', 'master'].map(knob), ...inputs.map((j) => jack('in', j.id)), ...outputs.map((j) => jack('out', j.id))]],
  { params, inputs, outputs },
  W,
  { maxPitch: 16 },
)
const FACE_Y = 14

/** LATTICE: a 16 × 16 grid of light buttons in the Tenori-on tradition (our
 *  own design). Eight layers drawn on the same lights, each with its own
 *  mode, sound, octave, loop, rate and swing; every note it plays ripples out
 *  across the grid. Rows follow SCALE in KEY. */
export const lattice: ModuleSpec = {
  type: 'lattice',
  title: 'LATTICE',
  name: 'LATTICE Light Grid',
  tagline: 'A 16×16 grid of light buttons: eight layers that score, bounce, wander, hold, play by hand or loop what you draw, each note rippling across the lights',
  category: 'Systems',
  hp: HP,
  panel: BLUE,
  inputs,
  outputs,
  params,
  leds: LT_LEDS,
  controls: [{ kind: 'surface', name: 'lattice', x: 4, y: FACE_Y, w: W - 8, h: rows.top - 1.6 - FACE_Y, bare: true }, ...rows.controls],
}
