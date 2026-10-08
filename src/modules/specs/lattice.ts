import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLUE } from './panels'
import { QUANT_SCALES } from './shapers'
import { cellId, drawCell, drawId, drawLenId, LT_DRAW, LT_KEYS, LT_LEDS, LT_MODES, LT_OUTS, LT_PAGES, LT_RATES, LT_SIZE, LT_SOUNDS } from './latticeDefs'
import { LAYERS, PAGES, type Lights } from './latticeFactory'

export * from './latticeDefs'

const opt = (id: string, label: string, options: string[], def: number): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })

/** One layer's lights and trace on page `pg`. */
const lightParams = (d: Lights, l: number, pg: number): ParamSpec[] => {
  const name = `${pg > 0 ? `${LT_PAGES[pg]} ` : ''}L${l + 1}`
  return [
    ...Array.from({ length: LT_SIZE }, (_, x): ParamSpec => ({
      id: cellId(l, x, pg),
      label: `${name} COLUMN ${x + 1}`,
      min: 0,
      max: 0xffff,
      def: (d.cells[x] ?? []).reduce((m, y) => m | (1 << y), 0),
      stepped: true,
    })),
    { id: drawLenId(l, pg), label: `${name} TRACE LENGTH`, min: 0, max: LT_DRAW, def: d.trace?.length ?? 0, stepped: true },
    ...Array.from({ length: LT_DRAW }, (_, i): ParamSpec => {
      const c = d.trace?.[i]
      return { id: drawId(l, i, pg), label: `${name} TRACE ${i + 1}`, min: 0, max: LT_SIZE * LT_SIZE, def: c ? drawCell(c[0], c[1]) : 0, stepped: true }
    }),
  ]
}

const params: ParamSpec[] = [
  opt('layer', 'LAYER', LAYERS.map((_, l) => `${l + 1}`), 0),
  opt('page', 'PAGE', LT_PAGES, 0),
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
  ]),
  ...PAGES.flatMap((page, pg) => page.flatMap((d, l) => lightParams(d, l, pg))),
]

/** The per-layer settings the side of the face edits, for layer `l`. */
export const layerParams = (l: number) => ({ mode: `mode${l}`, snd: `snd${l}`, oct: `oct${l}`, len: `len${l}`, rate: `rate${l}`, vol: `vol${l}`, swing: `swing${l}` })

const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'run', label: 'RUN' },
  { id: 'reset', label: 'RESET' },
  { id: 'page', label: 'PAGE' },
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
 *  across the grid. Rows follow SCALE in KEY. Four pages A–D each hold the
 *  whole grid; a new one waits for the end of the bar. */
export const lattice: ModuleSpec = {
  type: 'lattice',
  title: 'LATTICE',
  name: 'LATTICE Light Grid',
  tagline: 'A 16×16 grid of light buttons: eight layers that score, bounce, wander, hold, play by hand or loop what you draw; four pages',
  category: 'Systems',
  hp: HP,
  panel: BLUE,
  inputs,
  outputs,
  params,
  leds: LT_LEDS,
  controls: [{ kind: 'surface', name: 'lattice', x: 4, y: FACE_Y, w: W - 8, h: rows.top - 1.6 - FACE_Y, bare: true }, ...rows.controls],
}
