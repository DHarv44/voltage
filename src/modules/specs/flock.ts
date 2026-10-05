import type { ModuleSpec } from '../types'
import { BLUE } from './panels'

export const BOIDS = 24
/** LED layout: x, y, heading per boid. */
export const FLOCKL = { boids: 0 } as const

/** A flock of 24 birds (boids): each steers to avoid its neighbours, match
 *  their heading and stay with the group. What comes out is the flock as a
 *  whole — its centre, how spread out it is, how fast and which way it flies —
 *  as smooth, living CV. TX/TY give it somewhere to go; SCATTER (or a click)
 *  startles it; TURN fires when the flock wheels round. */
export const flock: ModuleSpec = {
  type: 'flock',
  title: 'FLOCK',
  name: 'Flock',
  tagline: '24 boids: centre, spread, speed and heading of the flock as CV; TURN gate when it wheels',
  category: 'Simulations',
  hp: 16,
  panel: BLUE,
  inputs: [
    { id: 'tx', label: 'TX' },
    { id: 'ty', label: 'TY' },
    { id: 'scatter', label: 'SCATTER' },
  ],
  outputs: [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
    { id: 'spread', label: 'SPREAD' },
    { id: 'speed', label: 'SPEED' },
    { id: 'head', label: 'HEADING' },
    { id: 'turn', label: 'TURN' },
  ],
  params: [
    { id: 'cohesion', label: 'COHESION', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'align', label: 'ALIGN', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'separate', label: 'SEPARATE', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'speed', label: 'SPEED', min: 0.05, max: 1, def: 0.3, curve: 'exp', unit: 'x' },
  ],
  leds: BOIDS * 3,
  controls: [
    { kind: 'surface', name: 'flock', x: 4, y: 15, w: 73.3, h: 48 },
    ...['cohesion', 'align', 'separate', 'speed'].map((param, i) => ({ kind: 'knob' as const, param, x: 12 + i * 18, y: 72, size: 'S' as const })),
    { kind: 'in', jack: 'tx', x: 12, y: 91 },
    { kind: 'in', jack: 'ty', x: 26, y: 91 },
    { kind: 'in', jack: 'scatter', x: 40, y: 91 },
    { kind: 'out', jack: 'turn', x: 68, y: 98.9 },
    ...['x', 'y', 'spread', 'speed', 'head'].map((jack, i) => ({ kind: 'out' as const, jack, x: 12 + i * 14, y: 113.5 })),
  ],
}
