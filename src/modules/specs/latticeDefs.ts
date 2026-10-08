/** LATTICE's vocabulary, shared by the spec, the engine and the face. */

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
export const LT_SOUNDS = ['BELL', 'PLUCK', 'GLASS', 'PAD', 'BASS', 'DRUMS']
export const DRUMS = 5
export const LT_RATES = ['1/4', '1/8', '1/16', '1/32']
/** 16ths per step at each rate. */
export const LT_RATE_STEPS = [4, 2, 1, 0.5]
export const LT_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const LT_COLORS = ['#8fe8ff', '#ffb36b', '#c9a2ff', '#a6ff9a', '#ff8fb8', '#ffe06b', '#6bffd8', '#b0b8ff']

// ---- pages ----
// Four pages, A–D, each the whole grid: every layer's lights and trace. The
// layers' settings (mode, sound, loop…) are shared. Page A keeps the plain
// ids, so racks saved before pages load as page A; B–D are prefixed `B.`…

export const LT_PAGES = ['A', 'B', 'C', 'D']
/** A page change waits for the end of the bar: this many master 16ths. */
export const LT_BAR = 16
/** PAGE in: each page's share of 0–10 V. */
export const LT_PAGE_VOLTS = 2.5
const pre = (pg: number) => (pg > 0 ? `${LT_PAGES[pg]}.` : '')
export const cellId = (l: number, x: number, pg = 0) => `${pre(pg)}g${l}_${x}`
export const drawId = (l: number, i: number, pg = 0) => `${pre(pg)}dw${l}_${i}`
export const drawLenId = (l: number, pg = 0) => `${pre(pg)}dwn${l}`
/** A traced cell as stored (0 = a rest). */
export const drawCell = (x: number, y: number) => 1 + x * LT_SIZE + y

/** Every param one page holds (for copying a page). */
export const pageIds = (pg: number): string[] =>
  Array.from({ length: LT_LAYERS }, (_, l) => [
    ...Array.from({ length: LT_SIZE }, (_, x) => cellId(l, x, pg)),
    drawLenId(l, pg),
    ...Array.from({ length: LT_DRAW }, (_, i) => drawId(l, i, pg)),
  ]).flat()

/** LED block per layer: the column playing (HOLD: the loop step; SOLO: a
 *  count of notes played), the dot just played (x, y: RANDOM, SOLO, DRAW),
 *  and each column's ball height (BOUNCE); then the page playing. */
export const LTL = { block: 3 + LT_SIZE, col: 0, rx: 1, ry: 2, balls: 3 } as const
export const LT_PAGE_LED = LTL.block * LT_LAYERS
export const LT_LEDS = LT_PAGE_LED + 1
