import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { GRAPHITE } from './panels'

export const AR_SECTIONS = 16
export const AR_PARTS = 4
export const AR_PATTERNS = ['A', 'B', 'C', 'D']
/** LEDs: the section playing (−1 stopped) and the step within it. */
export const ARL = { section: 0, step: 1 } as const

/** The factory song: a section's bars, pattern and which parts play (bit k = part k + 1). */
const FACTORY: [bars: number, pat: number, parts: number][] = [
  [4, 0, 0b0011],
  [4, 0, 0b0111],
  [8, 1, 0b1111],
  [4, 2, 0b0101],
  [8, 1, 0b1111],
  [4, 3, 0b0001],
]

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const arParams: ParamSpec[] = [
  { id: 'tempo', label: 'BPM', min: 40, max: 220, def: 120, unit: 'bpm' },
  { id: 'len', label: 'SECTIONS', min: 1, max: AR_SECTIONS, def: FACTORY.length, stepped: true },
  { id: 'loop', label: 'LOOP', min: 0, max: 1, def: 1, stepped: true, options: ['ONCE', 'LOOP'] },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ...Array.from({ length: AR_SECTIONS }, (_, k): ParamSpec[] => {
    const f = FACTORY[k] ?? FACTORY[FACTORY.length - 1]
    return [
      { id: `b${k}`, label: `BARS ${k + 1}`, min: 1, max: 16, def: f[0], stepped: true },
      { id: `p${k}`, label: `PATTERN ${k + 1}`, min: 0, max: AR_PATTERNS.length - 1, def: f[1], stepped: true, options: AR_PATTERNS },
      { id: `m${k}`, label: `PARTS ${k + 1}`, min: 0, max: 15, def: f[2], stepped: true },
    ]
  }).flat(),
]
const arIn: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
]
const arOut: ModuleSpec['outputs'] = [
  { id: 'pat', label: 'PAT' },
  { id: 'sec', label: 'SECTION' },
  ...Array.from({ length: AR_PARTS }, (_, k) => ({ id: `g${k + 1}`, label: `PART ${k + 1}` })),
  { id: 'chg', label: 'CHANGE' },
  { id: 'end', label: 'END' },
  { id: 'bar', label: 'BAR' },
]

/** A song arranger: a row of sections, each some bars long, with a pattern
 *  letter (PAT: 0–10 V in four bands, what LOCKSTEP's PAT and LATTICE's PAGE
 *  read, sent a 16th early so they change on the bar) and which of four parts
 *  play (PART gates: patch them to VCAs or mixer CVs to bring parts in and
 *  out). Follows 16ths at CLK, or its own tempo. */
export const arranger: ModuleSpec = {
  type: 'arranger',
  title: 'ARRANGER',
  name: 'Song Arranger',
  tagline: 'Sections in a row, each with its bars, a pattern letter and four parts on or off: PAT for pattern changes, PART gates to bring parts in and out',
  category: 'Sequencers',
  hp: 24,
  panel: GRAPHITE,
  inputs: arIn,
  outputs: arOut,
  params: arParams,
  leds: 2,
  controls: (() => {
    const w = 24 * HP_MM
    const { controls, top } = packRows(
      [
        [knob('tempo'), knob('len'), sw('loop'), sw('run'), jack('in', 'clk'), jack('in', 'rst'), jack('out', 'chg'), null],
        [jack('out', 'pat'), jack('out', 'sec'), jack('out', 'g1'), jack('out', 'g2'), jack('out', 'g3'), jack('out', 'g4'), jack('out', 'end'), jack('out', 'bar')],
      ],
      { params: arParams, inputs: arIn, outputs: arOut },
      w,
      { gap: 1.6 },
    )
    return [{ kind: 'surface', name: 'arranger', x: 4, y: 14, w: w - 8, h: top - BEZEL - 1.5 - 14 } as Control, ...controls]
  })(),
}
