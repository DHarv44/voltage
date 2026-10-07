import type { ModuleSpec } from '../types'
import { BLACK, BLUE, RED } from './panels'

export const SCENE_SLOTS = 8
export const MACROS = 4
/** SCENES LEDs: the scene the CV asks for (−1 none) and a request counter. */
export const SCENEL = { want: 0, count: 1 } as const

/** Scene memory. Each slot stores every knob in the rack (click an empty slot,
 *  or turn STORE on and click). Click a stored slot to go there — gliding over
 *  TIME, so a recall can be a slow transformation. SCENE CV (0–10 V) picks a
 *  slot, NEXT steps through the stored ones. Right-click a slot to empty it. */
export const scenes: ModuleSpec = {
  type: 'scenes',
  title: 'SCENES',
  name: 'Scene Memory',
  tagline: 'Snapshot the whole rack into 8 scenes; recall them with a glide; CV picks the scene',
  category: 'Performance',
  hp: 12,
  panel: BLUE,
  inputs: [
    { id: 'scene', label: 'SCENE' },
    { id: 'next', label: 'NEXT' },
  ],
  outputs: [],
  params: [
    { id: 'time', label: 'TIME', min: 0, max: 20, def: 1.5, unit: 's' },
    { id: 'store', label: 'STORE', min: 0, max: 1, def: 0, stepped: true, options: ['RECALL', 'STORE'] },
  ],
  leds: 2,
  controls: [
    { kind: 'surface', name: 'scenes', x: 5, y: 15, w: 51, h: 56 },
    { kind: 'knob', param: 'time', x: 17, y: 84 },
    { kind: 'switch', param: 'store', x: 44, y: 84 },
    { kind: 'in', jack: 'scene', x: 17, y: 108 },
    { kind: 'in', jack: 'next', x: 44, y: 108 },
  ],
}

/** Macro knobs. LEARN on a macro, move any knobs in the rack, LEARN again: from
 *  then on that macro sweeps all of them at once, from where they were to
 *  where you left them. CV inputs move the macros too. */
export const macro: ModuleSpec = {
  type: 'macro',
  title: 'MACRO',
  name: 'Macro Knobs',
  tagline: 'Four knobs that each move many: LEARN, turn some knobs, LEARN — one turn does it all',
  category: 'Performance',
  hp: 12,
  panel: RED,
  inputs: Array.from({ length: MACROS }, (_, i) => ({ id: `cv${i + 1}`, label: `CV${i + 1}` })),
  outputs: [],
  params: Array.from({ length: MACROS }, (_, i) => ({ id: `m${i + 1}`, label: `MACRO ${i + 1}`, min: 0, max: 1, def: 0, unit: '%' as const })),
  leds: MACROS,
  controls: [
    ...Array.from({ length: MACROS }, (_, i) => ({ kind: 'knob' as const, param: `m${i + 1}`, x: i % 2 ? 44 : 17, y: i < 2 ? 30 : 58, size: 'L' as const })),
    { kind: 'surface', name: 'macro', x: 5, y: 72, w: 51, h: 18 },
    ...Array.from({ length: MACROS }, (_, i) => ({ kind: 'in' as const, jack: `cv${i + 1}`, x: 10 + i * 13.7, y: 108 })),
  ],
}

/** Happy accident. ROLL nudges a few random knobs somewhere nearby (AMOUNT says
 *  how far) — instant variations, and Ctrl+Z if you hate it. EVOLVE keeps
 *  doing it, slowly, by itself; TRIG rolls from the rack. Volume knobs on the
 *  outputs are never touched. */
export const accident: ModuleSpec = {
  type: 'accident',
  title: 'ACCIDENT',
  name: 'Happy Accident',
  tagline: 'Nudge random knobs for instant variations; EVOLVE keeps drifting; always undoable',
  category: 'Performance',
  hp: 8,
  panel: BLACK,
  inputs: [{ id: 'trig', label: 'TRIG' }],
  outputs: [],
  params: [
    { id: 'amount', label: 'AMOUNT', min: 0.01, max: 0.5, def: 0.1, curve: 'exp', unit: '%' },
    { id: 'count', label: 'KNOBS', min: 1, max: 8, def: 3, stepped: true },
    { id: 'evolve', label: 'EVOLVE', min: 0, max: 1, def: 0, unit: '%' },
  ],
  leds: 1,
  controls: [
    { kind: 'surface', name: 'accident', x: 5, y: 15, w: 30.6, h: 22 },
    { kind: 'knob', param: 'amount', x: 20.3, y: 50 },
    { kind: 'knob', param: 'count', x: 12, y: 72, size: 'S' },
    { kind: 'knob', param: 'evolve', x: 29, y: 72, size: 'S' },
    { kind: 'in', jack: 'trig', x: 20.3, y: 106 },
  ],
}
