import type { ModuleSpec } from '../types'
import { SAND } from './panels'

/** First-string choices (semitones from Sa, below it). */
export const TANPURA_FIRST = ['PA', 'MA', 'NI']
export const TANPURA_FIRST_SEMIS = [-5, -7, -1]
export const TANL = { string: 0, flash: 1 } as const

/** Tanpura: four strings over a curved jawari bridge, plucked in the
 *  traditional cycle (Pa/Ma/Ni, Sa, Sa, low Sa) to hold a shimmering drone.
 *  JAWARI sets how hard the strings graze the bridge (the buzz); click a
 *  string to pluck it yourself, or CLK each pluck from the rack. */
export const tanpura: ModuleSpec = {
  type: 'tanpura',
  title: 'TANPURA',
  name: 'Tanpura',
  tagline: 'Four-string drone with the buzzing jawari bridge; plucks itself in the classic cycle',
  category: 'Instruments',
  hp: 14,
  panel: SAND,
  inputs: [
    { id: 'voct', label: 'V/OCT' },
    { id: 'clk', label: 'CLK' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'gate', label: 'PLUCK' },
  ],
  params: [
    { id: 'sa', label: 'SA', min: -12, max: 12, def: -11, stepped: true, unit: 'st' },
    { id: 'first', label: '1ST', min: 0, max: 2, def: 0, stepped: true, options: TANPURA_FIRST },
    { id: 'cycle', label: 'CYCLE', min: 1.5, max: 10, def: 4.5, curve: 'exp', unit: 's' },
    { id: 'jawari', label: 'JAWARI', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'decay', label: 'SUSTAIN', min: 2, max: 20, def: 9, curve: 'exp', unit: 's' },
    { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  ],
  leds: 2,
  controls: [
    { kind: 'surface', name: 'tanpura', x: 5, y: 15, w: 61, h: 50 },
    // four columns (12 / 26 / 44 / 58) shared by the knobs and the jacks
    { kind: 'knob', param: 'sa', x: 12, y: 75, size: 'S' },
    { kind: 'switch', param: 'first', x: 26, y: 75 },
    { kind: 'knob', param: 'cycle', x: 44, y: 75, size: 'S' },
    { kind: 'knob', param: 'jawari', x: 58, y: 75, size: 'S' },
    { kind: 'knob', param: 'decay', x: 12, y: 93, size: 'S' },
    { kind: 'knob', param: 'level', x: 58, y: 93, size: 'S' },
    { kind: 'in', jack: 'voct', x: 12, y: 113.5 },
    { kind: 'in', jack: 'clk', x: 26, y: 113.5 },
    { kind: 'out', jack: 'gate', x: 44, y: 113.5 },
    { kind: 'out', jack: 'out', x: 58, y: 113.5 },
  ],
}
