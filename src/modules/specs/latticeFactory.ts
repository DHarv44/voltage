import { BOUNCE, DRAW, DRUMS, RANDOM, SCORE } from './latticeDefs'

/** LATTICE's factory content: each layer's settings, and what's lit on each
 *  page (rows are scale degrees of A minor; on DRUMS, row 0 kick, 1 snare,
 *  3 hat). */

export interface LayerDef {
  mode: number
  snd: number
  oct: number
  rate: number
  vol: number
  swing?: number
}

/** One layer's part of a page: lit cells (column → rows), and DRAW's trace. */
export interface Lights {
  cells: Record<number, number[]>
  trace?: [number, number][]
}

/** A bell line, bouncing plucks, a beat, a slow pad, a drawn glass line
 *  (swung); layers 6–8 empty. */
const EMPTY: LayerDef = { mode: SCORE, snd: 0, oct: 0, rate: 2, vol: 0.5 }
export const LAYERS: LayerDef[] = [
  { mode: SCORE, snd: 0, oct: 1, rate: 2, vol: 0.6 },
  { mode: BOUNCE, snd: 1, oct: 1, rate: 2, vol: 0.55 },
  { mode: SCORE, snd: DRUMS, oct: 0, rate: 2, vol: 0.7 },
  { mode: RANDOM, snd: 3, oct: 0, rate: 0, vol: 0.4 },
  { mode: DRAW, snd: 2, oct: 0, rate: 1, vol: 0.3, swing: 0.2 },
  EMPTY,
  EMPTY,
  EMPTY,
]

/** A trace that climbs and falls back (what a hand drawing a hill plays), and its valley. */
const HILL: [number, number][] = [[1, 7], [2, 8], [3, 9], [4, 11], [5, 12], [6, 11], [7, 9], [8, 8], [9, 7], [10, 5], [11, 4], [12, 5]]
const VALLEY: [number, number][] = HILL.map(([x, y]) => [x, 16 - y])
const traced = (t: [number, number][]): Lights => ({ cells: Object.fromEntries(t.map(([x, y]) => [x, [y]])), trace: t })
const none: Lights = { cells: {} }

/** Pages: A the tune, B a variation (busier beat, the line turned over), C a
 *  breakdown (hats, pad and the drawn line), D blank. */
export const PAGES: Lights[][] = [
  [
    { cells: { 0: [7], 2: [9], 3: [11], 6: [10], 8: [7], 10: [12], 11: [11], 14: [9] } },
    { cells: { 2: [5], 5: [3], 9: [7], 12: [4] } },
    { cells: { 0: [0], 2: [3], 4: [0, 1], 6: [3], 8: [0], 10: [3], 12: [0, 1], 14: [3] } },
    { cells: { 1: [2], 5: [4], 9: [0], 13: [6] } },
    traced(HILL),
    none,
    none,
    none,
  ],
  [
    { cells: { 0: [9], 2: [7], 4: [11], 6: [12], 8: [9], 10: [7], 12: [14], 14: [12] } },
    { cells: { 1: [4], 4: [6], 8: [2], 13: [5] } },
    { cells: { 0: [0], 2: [3], 3: [3], 4: [1], 6: [0, 3], 8: [0], 10: [3], 11: [0], 12: [1], 14: [3], 15: [3] } },
    { cells: { 3: [1], 7: [5], 11: [3] } },
    traced(VALLEY),
    none,
    none,
    none,
  ],
  [
    { cells: { 0: [7], 8: [9] } },
    none,
    { cells: { 2: [3], 6: [3], 10: [3], 14: [3] } },
    { cells: { 1: [0], 5: [2], 9: [4], 13: [5] } },
    traced(HILL),
    none,
    none,
    none,
  ],
  Array.from({ length: 8 }, () => none),
]
