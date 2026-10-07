import type { ModuleSpec } from '../types'
import { DRUM } from './panels'

/** Groove maps: one string per row (KICK, SNARE, HAT, OPEN, GHOST), 16 steps,
 *  each digit the chance (×1/9) a drummer plays that step. */
export const BAND_STYLES: { name: string; swing: number; rows: string[] }[] = [
  { name: 'ROCK', swing: 0, rows: ['9000004090400000', '0000900000009000', '9090909090909090', '0000000000000003', '0002000200020002'] },
  { name: 'FUNK', swing: 0.1, rows: ['9002000900302000', '0000900200009002', '9696969696969696', '0000000300000003', '0030030003000300'] },
  { name: 'HOUSE', swing: 0.04, rows: ['9000900090009000', '0000900000009000', '3030303030303030', '0090009000900090', '0000000000000200'] },
  { name: 'HIPHOP', swing: 0.18, rows: ['9000000900900020', '0000900000009000', '9090909090909090', '0000000000000020', '0020002000200002'] },
  { name: 'BOSSA', swing: 0, rows: ['9000009090000090', '9009009000909000', '9090909090909090', '0000000000000000', '0000000000000000'] },
]
export const BAND_ROWS = ['KICK', 'SNARE', 'HAT', 'OPEN', 'TOM', 'CRASH']
/** LED layout: the bar being played (row-major hits, 0..1 velocity), step, fill flag. */
export const BANDL = { grid: 0, step: BAND_ROWS.length * 16, fill: BAND_ROWS.length * 16 + 1 } as const

/** A drummer. Plays a STYLE's groove, never quite the same bar twice:
 *  ENERGY decides how busy (ghost notes, extra kicks), fills come at the end
 *  of every PHRASE (snare rolls, tom runs, unison hits) with a crash after,
 *  HUMAN adds timing and dynamics. Patch LISTEN to your playing and it lays
 *  back when you get loud. Triggers out for any drum modules. */
export const bandmate: ModuleSpec = {
  type: 'bandmate',
  title: 'BANDMATE',
  name: 'Bandmate (Drummer)',
  tagline: 'A drummer brain: grooves in a style, varies every bar, fills at phrase ends, follows energy',
  category: 'Brains',
  hp: 20,
  panel: DRUM,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'energy', label: 'ENERGY' },
    { id: 'listen', label: 'LISTEN' },
  ],
  outputs: [
    ...BAND_ROWS.map((r) => ({ id: r.toLowerCase(), label: r })),
    { id: 'acc', label: 'ACCENT' },
    { id: 'tompitch', label: 'TOM CV' },
    { id: 'fill', label: 'FILL' },
  ],
  params: [
    { id: 'style', label: 'STYLE', min: 0, max: BAND_STYLES.length - 1, def: 0, stepped: true, options: BAND_STYLES.map((s) => s.name) },
    { id: 'tempo', label: 'TEMPO', min: 60, max: 180, def: 100, unit: 'bpm' },
    { id: 'energy', label: 'ENERGY', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'phrase', label: 'PHRASE', min: 1, max: 8, def: 4, stepped: true },
    { id: 'human', label: 'HUMAN', min: 0, max: 1, def: 0.4, unit: '%' },
    { id: 'run', label: 'RUN', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ],
  leds: BAND_ROWS.length * 16 + 2,
  controls: [
    { kind: 'surface', name: 'bandmate', x: 5, y: 15, w: 91.6, h: 34 },
    { kind: 'knob', param: 'style', x: 12, y: 60, size: 'S' },
    { kind: 'knob', param: 'tempo', x: 28, y: 60, size: 'S' },
    { kind: 'knob', param: 'energy', x: 44, y: 60, size: 'S' },
    { kind: 'knob', param: 'phrase', x: 60, y: 60, size: 'S' },
    { kind: 'knob', param: 'human', x: 76, y: 60, size: 'S' },
    // everything on one 16 mm column grid: 12, 28, 44, 60, 76, 92
    { kind: 'switch', param: 'run', x: 92, y: 60 },
    { kind: 'in', jack: 'clk', x: 12, y: 84.3 },
    { kind: 'in', jack: 'energy', x: 28, y: 84.3 },
    { kind: 'in', jack: 'listen', x: 44, y: 84.3 },
    { kind: 'out', jack: 'acc', x: 60, y: 84.3 },
    { kind: 'out', jack: 'tompitch', x: 76, y: 84.3 },
    { kind: 'out', jack: 'fill', x: 92, y: 84.3 },
    ...BAND_ROWS.map((r, i) => ({ kind: 'out' as const, jack: r.toLowerCase(), x: 12 + i * 16, y: 113.5 })),
  ],
}
