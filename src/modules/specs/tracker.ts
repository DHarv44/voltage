import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { SOUND_NAMES } from './sampling'
import { BLUE } from './panels'

export const TK_CH = 4
export const TK_ROWS = 64
export const TK_PATTERNS = 4
export const TK_ORDER = 16
/** Note values: 0 = empty, 1..96 = C-0 … B-7, 97 = note off. */
export const TK_OFF = 97
/** Samples: 1..8 the factory sounds, 9 yours (0 = keep the channel's). */
export const TK_SAMPLES = SOUND_NAMES.length + 1
/** LEDs: pattern playing, row playing (−1 stopped), order position, then
 *  each channel's level (0..1). */
export const TKRL = { pat: 0, row: 1, ord: 2, level0: 3 } as const

/** A cell packed into one number: note (7 bits), sample (4), effect (4),
 *  effect value (8). */
export interface Cell {
  note: number
  smp: number
  fx: number
  fxp: number
}
export const packCell = (c: Cell): number => c.note + c.smp * 128 + c.fx * 2048 + c.fxp * 32768
export const unpackCell = (v: number): Cell => {
  const n = Math.max(0, Math.round(v))
  return { note: n % 128, smp: Math.floor(n / 128) % 16, fx: Math.floor(n / 2048) % 16, fxp: Math.floor(n / 32768) % 256 }
}
export const cellId = (pat: number, row: number, ch: number) => `p${pat}r${row}c${ch}`

const NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-']
export const noteName = (n: number) => (n === 0 ? '---' : n === TK_OFF ? '===' : `${NAMES[(n - 1) % 12]}${Math.floor((n - 1) / 12)}`)
export const hex = (v: number, digits: number) => v.toString(16).toUpperCase().padStart(digits, '0')

/** The factory song: a bass line, a beat from the break's hits and a
 *  bell melody (C minor), in pattern A. */
function factory(): Map<string, number> {
  const m = new Map<string, number>()
  const n = (name: string, oct: number) => NAMES.indexOf(name) + 1 + oct * 12
  const put = (row: number, ch: number, note: number, smp: number, fx = 0, fxp = 0) => m.set(cellId(0, row, ch), packCell({ note, smp, fx, fxp }))
  const bass = ['C-', 'C-', 'G-', 'C-', 'D#', 'D#', 'A#', 'D#', 'F-', 'F-', 'C-', 'F-', 'G-', 'G-', 'D-', 'G-']
  bass.forEach((b, i) => put(i * 4, 0, n(b, b === 'A#' || b === 'G-' || b === 'D-' ? 2 : 3), 5))
  // the beat: the break's own kick and snare, cut out by the sample offset (9xx)
  for (let r = 0; r < TK_ROWS; r += 8) put(r, 1, n('C-', 4), 8, 0x9, 0x00)
  for (let r = 4; r < TK_ROWS; r += 8) put(r, 1, n('C-', 4), 8, 0x9, 0x21)
  const tune = ['G-', 'D#', 'C-', 'D#', 'F-', 'G-', 'A#', 'G-']
  tune.forEach((t, i) => put(i * 8, 2, n(t, 5), 4, i % 2 ? 4 : 0, i % 2 ? 0x43 : 0))
  put(0, 3, n('C-', 4), 2, 0xc, 0x18)
  put(32, 3, n('G#', 3), 2, 0xc, 0x18)
  return m
}
const FACTORY = factory()

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'bpm', label: 'BPM', min: 32, max: 255, def: 125, stepped: true },
  { id: 'speed', label: 'SPEED', min: 1, max: 31, def: 6, stepped: true },
  { id: 'len', label: 'SONG LENGTH', min: 1, max: TK_ORDER, def: 1, stepped: true },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'led', label: 'FILTER', min: 0, max: 1, def: 0, stepped: true, options: ['OFF', 'LED'] },
  { id: 'model', label: 'MODEL', min: 0, max: 1, def: 0, stepped: true, options: ['EARLY', 'LATER'] },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  { id: 'rec', label: 'EDIT', min: 0, max: 1, def: 0, stepped: true, options: ['OFF', 'REC'] },
  { id: 'cur', label: 'CURSOR ROW', min: 0, max: TK_ROWS - 1, def: 0, stepped: true },
  { id: 'curch', label: 'CURSOR CHANNEL', min: 0, max: TK_CH - 1, def: 0, stepped: true },
  { id: 'edpat', label: 'EDITING', min: 0, max: TK_PATTERNS - 1, def: 0, stepped: true, options: ['A', 'B', 'C', 'D'] },
  { id: 'edsmp', label: 'SAMPLE', min: 1, max: TK_SAMPLES, def: 5, stepped: true },
  ...Array.from({ length: TK_ORDER }, (_, i): ParamSpec => ({ id: `o${i}`, label: `ORDER ${i + 1}`, min: 0, max: TK_PATTERNS - 1, def: 0, stepped: true, options: ['A', 'B', 'C', 'D'] })),
  ...Array.from({ length: TK_PATTERNS }, (_, pt) =>
    Array.from({ length: TK_ROWS * TK_CH }, (_, i): ParamSpec => {
      const id = cellId(pt, Math.floor(i / TK_CH), i % TK_CH)
      return { id, label: `CELL ${id}`, min: 0, max: 2 ** 23 - 1, def: FACTORY.get(id) ?? 0, stepped: true }
    }),
  ).flat(),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
  { id: 'in', label: 'IN' },
  { id: 'recg', label: 'SAMPLE' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
  ...Array.from({ length: TK_CH }, (_, c) => ({ id: `ch${c + 1}`, label: `CH ${c + 1}` })),
]

const HP = 52
const W = HP * HP_MM
const layout = packRows(
  [
    [knob('bpm'), knob('speed'), knob('len'), knob('level'), sw('led'), sw('model'), sw('run'), sw('rec'), { kind: 'file', slot: 0, x: 0, y: 0, label: 'LOAD' }, { kind: 'button', name: 'sample', x: 0, y: 0, label: 'SAMPLE', led: TKRL.level0 + TK_CH, ledColor: '#ff3b2f' }],
    [jack('in', 'clk'), jack('in', 'rst'), jack('in', 'in'), jack('in', 'recg'), jack('out', 'ch1'), jack('out', 'ch2'), jack('out', 'ch3'), jack('out', 'ch4'), jack('out', 'l'), jack('out', 'r')],
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 1.6 },
)

/** TRACKER: a home-computer tracker of the late 80s (our own take). Four
 *  channels of 8-bit samples (the factory sounds, or one of your own,
 *  recorded or loaded), panned hard left and right as the original chip did,
 *  through its output filter (the earlier model's fixed one, and the LED
 *  filter you can switch in). Patterns of 64 rows, read top to bottom: a
 *  note, a sample number and an effect per channel per row (arpeggio,
 *  slides, vibrato, volume, retrigger, speed...); an order list chains them
 *  into a song. Turn EDIT to REC, click a cell, and play the keys to enter
 *  notes; scroll on a cell's parts to change them. */
export const tracker: ModuleSpec = {
  type: 'tracker',
  title: 'TRACKER',
  name: 'Tracker (Home-Computer 8-Bit)',
  tagline: 'A late-80s home-computer tracker: four 8-bit channels panned hard, 64-row patterns of notes, samples and effects, an order list; enter notes from the keys',
  category: 'Sampling & Tape',
  hp: HP,
  panel: BLUE,
  inputs,
  outputs,
  params,
  leds: TKRL.level0 + TK_CH + 1,
  controls: [{ kind: 'surface', name: 'tracker', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
