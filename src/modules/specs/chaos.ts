import type { ModuleSpec } from '../types'
import { RED } from './panels'

/** LED layout: the trace point (x, y) and a flip flash. */
export const CHAOSL = { x: 0, y: 1, flip: 2 } as const

/** Deterministic chaos as modulation: a double pendulum (arm-tip X/Y, the
 *  outer arm's spin as Z; GATE when it flips over the top) or the Lorenz
 *  attractor (GATE each time it jumps to the other wing). Never repeats,
 *  never random. KICK gives the pendulum a shove (or the attractor a nudge). */
export const chaos: ModuleSpec = {
  type: 'chaos',
  title: 'CHAOS',
  name: 'Chaos',
  tagline: 'Double pendulum or Lorenz attractor as X/Y/Z CV; gates on flips and wing jumps; never repeats',
  category: 'Simulations',
  hp: 12,
  panel: RED,
  inputs: [
    { id: 'kick', label: 'KICK' },
    { id: 'rate', label: 'RATE' },
    { id: 'rst', label: 'RST' },
  ],
  outputs: [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'z', label: 'Z' },
    { id: 'gate', label: 'GATE' },
  ],
  params: [
    { id: 'mode', label: 'SYSTEM', min: 0, max: 1, def: 0, stepped: true, options: ['PENDULUM', 'LORENZ'] },
    { id: 'rate', label: 'RATE', min: 0.05, max: 4, def: 0.6, curve: 'exp', unit: 'x' },
    { id: 'energy', label: 'ENERGY', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'damp', label: 'FRICTION', min: 0, max: 1, def: 0.15, unit: '%' },
  ],
  leds: 3,
  controls: [
    { kind: 'surface', name: 'chaos', x: 5, y: 15, w: 51, h: 44 },
    { kind: 'switch', param: 'mode', x: 14, y: 69 },
    { kind: 'knob', param: 'rate', x: 32, y: 69, size: 'S' },
    { kind: 'knob', param: 'energy', x: 48, y: 69, size: 'S' },
    { kind: 'knob', param: 'damp', x: 48, y: 85, size: 'S' },
    { kind: 'in', jack: 'kick', x: 12, y: 92 },
    { kind: 'in', jack: 'rate', x: 26, y: 92 },
    { kind: 'in', jack: 'rst', x: 37.6, y: 92 },
    ...['x', 'y', 'z', 'gate'].map((jack, i) => ({ kind: 'out' as const, jack, x: 9 + i * 14.3, y: 113.5 })),
  ],
}
