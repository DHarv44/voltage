import type { ModuleSpec } from '../types'
import { BLUE } from './panels'

export const BALLS = 4
/** LED layout: x,y per ball, then a hit flash per ball. */
export const BOUNCEL = { pos: 0, flash: BALLS * 2 } as const

const OX = [12, 26, 40, 54]

/** Balls in a box. Each one falls, bounces and loses a little energy, so its
 *  rhythm speeds up as it settles — the bouncing-ball accelerando. Every
 *  impact fires that ball's gate (VEL = how hard). KICK throws them all back
 *  up; TILT leans gravity sideways so they roll and hit the walls too. Click
 *  in the box to drop a ball there, drag to throw it. */
export const bounce: ModuleSpec = {
  type: 'bounce',
  title: 'BOUNCE',
  name: 'Bouncing Balls',
  tagline: 'Balls under gravity: every impact is a gate; rhythms accelerate as they settle; KICK relaunches',
  category: 'Simulations',
  hp: 16,
  panel: BLUE,
  inputs: [
    { id: 'kick', label: 'KICK' },
    { id: 'grav', label: 'GRAV' },
    { id: 'tilt', label: 'TILT' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [
    ...Array.from({ length: BALLS }, (_, i) => ({ id: `g${i + 1}`, label: `G${i + 1}` })),
    { id: 'any', label: 'ANY' },
    { id: 'vel', label: 'VEL' },
    { id: 'x', label: 'X1' },
    { id: 'y', label: 'Y1' },
  ],
  params: [
    { id: 'balls', label: 'BALLS', min: 1, max: BALLS, def: 3, stepped: true },
    { id: 'gravity', label: 'GRAVITY', min: 0.2, max: 4, def: 1, curve: 'exp', unit: 'x' },
    { id: 'bounce', label: 'BOUNCE', min: 0.5, max: 0.99, def: 0.86, unit: '%' },
    { id: 'kickf', label: 'KICK', min: 0.2, max: 1, def: 0.7, unit: '%' },
  ],
  leds: BALLS * 3,
  controls: [
    { kind: 'surface', name: 'bounce', x: 4, y: 15, w: 73.3, h: 42 },
    { kind: 'knob', param: 'balls', x: 12, y: 65, size: 'S' },
    { kind: 'knob', param: 'gravity', x: 30, y: 65, size: 'S' },
    { kind: 'knob', param: 'bounce', x: 48, y: 65, size: 'S' },
    { kind: 'knob', param: 'kickf', x: 66, y: 65, size: 'S' },
    { kind: 'in', jack: 'kick', x: 12, y: 87 },
    { kind: 'in', jack: 'grav', x: 26, y: 87 },
    { kind: 'in', jack: 'tilt', x: 40, y: 87 },
    { kind: 'in', jack: 'rst', x: 40, y: 98.9 },
    { kind: 'out', jack: 'x', x: 54, y: 84.3 },
    { kind: 'out', jack: 'y', x: 68, y: 84.3 },
    { kind: 'out', jack: 'vel', x: 54, y: 98.9 },
    { kind: 'out', jack: 'any', x: 68, y: 98.9 },
    ...Array.from({ length: BALLS }, (_, i) => ({ kind: 'out' as const, jack: `g${i + 1}`, x: OX[i], y: 113.5 })),
  ],
}
