import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { GRAPHITE } from './panels'

export const XL_SECTIONS = 32
export const XL_PARTS = 8
export const XL_PATTERNS = ['A', 'B', 'C', 'D']
/** How a section begins: CUT (on the bar), FADE (parts glide in and out over
 *  its first bar), BUILD (the bar before it ramps up and fills), DROP (a
 *  build whose last beat falls silent, then everything at once). */
export const XL_TRANSITIONS = ['CUT', 'FADE', 'BUILD', 'DROP']
export const XL_NAMES = ['—', 'INTRO', 'VERSE', 'PRE', 'CHORUS', 'DROP', 'BREAK', 'BRIDGE', 'BUILD', 'SOLO', 'OUTRO']
export const XL_MAX_BARS = 32
/** FADE's settings, in bars. */
export const XL_FADE_BARS = [0.25, 0.5, 1, 2, 4]
/** LEDs: the section playing (−1 stopped), the 16th within it, the tempo now. */
export const XLL = { section: 0, step: 1, bpm: 2 } as const

/** A section's params, by field: bars, pattern, parts, transition, tempo
 *  (0 = the main TEMPO), transpose (semitones), scene (0 = none), name. */
export const XL_FIELDS = ['b', 'p', 'm', 'x', 't', 's', 'c', 'n'] as const
export const xlId = (field: (typeof XL_FIELDS)[number], k: number) => `${field}${k}`

/** The factory song: [name, bars, pattern, parts, transition]. Parts: 1 drums,
 *  2 bass, 3 chords, 4 lead, 5 pad, 6 perc, 7 FX, 8 extra. */
const FACTORY: [number, number, number, number, number][] = [
  [1, 8, 0, 0b00010100, 1],
  [2, 8, 1, 0b00000111, 0],
  [8, 4, 2, 0b00100111, 2],
  [4, 8, 3, 0b00111111, 3],
  [2, 8, 1, 0b00000111, 0],
  [4, 8, 3, 0b00111111, 3],
  [6, 8, 0, 0b00010100, 1],
  [8, 4, 2, 0b01000111, 2],
  [4, 8, 3, 0b01111111, 3],
  [10, 8, 0, 0b00010100, 1],
]

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const sectionParams = (k: number): ParamSpec[] => {
  const f = FACTORY[k] ?? FACTORY[FACTORY.length - 1]
  const n = k + 1
  return [
    { id: xlId('b', k), label: `BARS ${n}`, min: 1, max: XL_MAX_BARS, def: f[1], stepped: true },
    { id: xlId('p', k), label: `PATTERN ${n}`, min: 0, max: XL_PATTERNS.length - 1, def: f[2], stepped: true, options: XL_PATTERNS },
    { id: xlId('m', k), label: `PARTS ${n}`, min: 0, max: 2 ** XL_PARTS - 1, def: f[3], stepped: true },
    { id: xlId('x', k), label: `TRANSITION ${n}`, min: 0, max: XL_TRANSITIONS.length - 1, def: f[4], stepped: true, options: XL_TRANSITIONS },
    { id: xlId('t', k), label: `TEMPO ${n}`, min: 0, max: 220, def: 0, stepped: true, unit: 'bpm' },
    { id: xlId('s', k), label: `TRANSPOSE ${n}`, min: -12, max: 12, def: 0, stepped: true, unit: 'st' },
    { id: xlId('c', k), label: `SCENE ${n}`, min: 0, max: 8, def: 0, stepped: true },
    { id: xlId('n', k), label: `NAME ${n}`, min: 0, max: XL_NAMES.length - 1, def: f[0], stepped: true, options: XL_NAMES },
  ]
}

const params: ParamSpec[] = [
  { id: 'tempo', label: 'TEMPO', min: 40, max: 220, def: 120, unit: 'bpm' },
  { id: 'len', label: 'SECTIONS', min: 1, max: XL_SECTIONS, def: FACTORY.length, stepped: true },
  { id: 'fade', label: 'FADE', min: 0, max: XL_FADE_BARS.length - 1, def: 2, stepped: true, options: ['¼ BAR', '½ BAR', '1 BAR', '2 BARS', '4 BARS'] },
  { id: 'loop', label: 'LOOP', min: 0, max: 1, def: 1, stepped: true, options: ['ONCE', 'LOOP'] },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ...Array.from({ length: XL_SECTIONS }, (_, k) => sectionParams(k)).flat(),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
]
const parts = Array.from({ length: XL_PARTS }, (_, i) => i + 1)
const outputs: ModuleSpec['outputs'] = [
  { id: 'clko', label: 'CLK' },
  { id: 'rsto', label: 'RST' },
  { id: 'bar', label: 'BAR' },
  { id: 'chg', label: 'CHANGE' },
  { id: 'end', label: 'END' },
  { id: 'pat', label: 'PAT' },
  { id: 'sec', label: 'SECTION' },
  { id: 'scene', label: 'SCENE' },
  { id: 'trans', label: 'KEY' },
  { id: 'fill', label: 'FILL' },
  { id: 'ramp', label: 'RAMP' },
  ...parts.map((n) => ({ id: `g${n}`, label: `GATE ${n}` })),
  ...parts.map((n) => ({ id: `l${n}`, label: `LEVEL ${n}` })),
]

const HP = 60
const W = HP * HP_MM
const layout = packRows(
  [
    [knob('tempo'), knob('len'), knob('fade'), sw('loop'), sw('run'), jack('in', 'clk'), jack('in', 'rst'), jack('out', 'clko'), jack('out', 'rsto'), jack('out', 'bar'), jack('out', 'chg'), jack('out', 'end')],
    [jack('out', 'pat'), jack('out', 'sec'), jack('out', 'scene'), jack('out', 'trans'), jack('out', 'fill'), jack('out', 'ramp'), null, null, null, null, null, null],
    [...parts.map((n) => jack('out', `g${n}`)), null, null, null, null],
    [...parts.map((n) => jack('out', `l${n}`)), null, null, null, null],
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 1.2, maxPitch: 24 },
)

/** The big song arranger: up to 32 named sections, each with its bars, a
 *  pattern letter, which of eight parts play, how it begins (cut, fade,
 *  build, drop), its own tempo, a key change and a scene. Each part has a
 *  GATE and a LEVEL (gliding in and out on a fade, silent on a drop's last
 *  beat); FILL is high through every section's last bar and RAMP climbs
 *  through the bar before a build or drop, for risers and fills. It is the
 *  rack's clock too (CLK, RST, BAR out), or follows 16ths at CLK. */
export const arrangerxl: ModuleSpec = {
  type: 'arrangerxl',
  title: 'ARRANGER XL',
  name: 'Song Arranger XL',
  tagline: '32 named sections × 8 parts, each section with its own transition (cut, fade, build, drop), tempo, key and scene; part gates and fading levels, FILL and RAMP for builds; clocks the rack',
  category: 'Sequencers',
  hp: HP,
  panel: GRAPHITE,
  inputs,
  outputs,
  params,
  leds: 3,
  controls: [{ kind: 'surface', name: 'arrangerxl', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
