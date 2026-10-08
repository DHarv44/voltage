import type { ModuleSpec } from '../types'
import { GREEN } from './panels'

export const ECOL = { prey: 0, pred: 1 } as const

/** Predators and prey (Lotka–Volterra with a carrying capacity, plus a little
 *  chance). Rabbits breed until the grass runs short, foxes boom on rabbits,
 *  rabbits crash, foxes starve, rabbits recover… two slow CVs that chase each
 *  other but never quite repeat. BOOM/CRASH fire at the rabbits' peaks and
 *  troughs. FOOD feeds the meadow; CULL thins the foxes; if they die out, a
 *  few wander back in a while later (EXTINCT fires). */
export const ecosystem: ModuleSpec = {
  type: 'ecosystem',
  title: 'ECOSYSTEM',
  name: 'Predator & Prey',
  tagline: 'Rabbits and foxes (Lotka–Volterra): two chasing population CVs, boom/crash gates',
  category: 'Simulations',
  hp: 14,
  panel: GREEN,
  inputs: [
    { id: 'food', label: 'FOOD' },
    { id: 'cull', label: 'CULL' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [
    { id: 'prey', label: 'PREY' },
    { id: 'pred', label: 'PRED' },
    { id: 'boom', label: 'BOOM' },
    { id: 'crash', label: 'CRASH' },
    { id: 'extinct', label: 'EXTINCT' },
  ],
  params: [
    { id: 'rate', label: 'RATE', min: 0.02, max: 4, def: 0.4, curve: 'exp', unit: 'x' },
    { id: 'growth', label: 'BREED', min: 0.2, max: 2, def: 1, unit: 'x' },
    { id: 'hunt', label: 'HUNT', min: 0.2, max: 2, def: 1, unit: 'x' },
    { id: 'starve', label: 'STARVE', min: 0.2, max: 2, def: 1, unit: 'x' },
  ],
  leds: 2,
  controls: [
    { kind: 'surface', name: 'ecosystem', x: 5, y: 15, w: 61, h: 42 },
    ...['rate', 'growth', 'hunt', 'starve'].map((param, i) => ({ kind: 'knob' as const, param, x: 12 + i * 15.7, y: 67, size: 'S' as const })),
    { kind: 'in', jack: 'food', x: 12, y: 88 },
    { kind: 'in', jack: 'cull', x: 26, y: 88 },
    { kind: 'in', jack: 'rst', x: 40, y: 88 },
    { kind: 'out', jack: 'extinct', x: 59, y: 98.9 },
    ...['prey', 'pred', 'boom', 'crash'].map((jack, i) => ({ kind: 'out' as const, jack, x: 12 + i * 15.7, y: 113.5 })),
  ],
}
