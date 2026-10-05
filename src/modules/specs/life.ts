import type { ModuleSpec } from '../types'
import { GREEN } from './panels'
import { QUANT_SCALES } from './shapers'

export const LIFE_W = 16
export const LIFE_H = 8
/** LED layout: one per cell (row-major), then the playhead column. */
export const LIFEL = { cells: 0, col: LIFE_W * LIFE_H } as const

/** Conway's Game of Life as a sequencer. A playhead scans the 16 columns on
 *  each clock; live cells in that column fire their row's gate and PITCH plays
 *  the highest one in SCALE. After a full pass the colony evolves one
 *  generation, so the pattern grows, mutates and (sometimes) dies — RESEED or
 *  click cells to bring it back. Edges wrap: gliders fly forever. */
export const life: ModuleSpec = {
  type: 'life',
  title: 'LIFE',
  name: 'Game of Life Sequencer',
  tagline: "Conway's Life scanned as a sequencer: rows are gates, the colony evolves every pass",
  category: 'Simulations',
  hp: 20,
  panel: GREEN,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'reseed', label: 'RESEED' },
  ],
  outputs: [
    ...Array.from({ length: LIFE_H }, (_, i) => ({ id: `r${i + 1}`, label: `R${i + 1}` })),
    { id: 'pitch', label: 'PITCH' },
    { id: 'pop', label: 'POP' },
    { id: 'eoc', label: 'GEN' },
  ],
  params: [
    { id: 'rate', label: 'RATE', min: 0.5, max: 16, def: 6, curve: 'exp', unit: 'Hz' },
    { id: 'scale', label: 'SCALE', min: 0, max: QUANT_SCALES.length - 1, def: 4, stepped: true, options: QUANT_SCALES },
    { id: 'density', label: 'DENSITY', min: 0.1, max: 0.6, def: 0.3, unit: '%' },
  ],
  leds: LIFE_W * LIFE_H + 1,
  controls: [
    { kind: 'surface', name: 'life', x: 5, y: 15, w: 91.6, h: 46 },
    { kind: 'knob', param: 'rate', x: 14, y: 71, size: 'S' },
    { kind: 'knob', param: 'scale', x: 30, y: 71, size: 'S' },
    { kind: 'knob', param: 'density', x: 46, y: 71, size: 'S' },
    { kind: 'button', name: 'reseed', x: 62, y: 71, label: 'RESEED' },
    { kind: 'in', jack: 'clk', x: 76, y: 71 },
    { kind: 'in', jack: 'reseed', x: 90, y: 71 },
    ...Array.from({ length: LIFE_H }, (_, i) => ({ kind: 'out' as const, jack: `r${i + 1}`, x: 12 + (i % 4) * 14, y: i < 4 ? 98.9 : 113.5 })),
    { kind: 'out', jack: 'pitch', x: 68, y: 98.9 },
    { kind: 'out', jack: 'pop', x: 82, y: 98.9 },
    { kind: 'out', jack: 'eoc', x: 82, y: 113.5 },
  ],
}
