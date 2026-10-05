import type { ModuleSpec } from '../types'
import { BLACK } from './panels'

/** LED layout: your sounding note (−99 = none), the ghost's, and its state. */
export const GHOSTL = { you: 0, ghost: 1, state: 2 } as const
/** States: 0 listening, 1 waiting for its turn, 2 answering. */

/** Call and response. GHOST listens to what you play (QWERTY/MIDI keys, or
 *  V/OCT + GATE from the rack) and learns it: which intervals you use after
 *  which, how long your notes and gaps are, which notes are "yours". When you
 *  stop for WAIT seconds it answers with a phrase of its own, in your style.
 *  TEMPER makes it bolder (0 = it mostly quotes you); MEMORY is how long it
 *  remembers before your old habits fade. Patch its V/OCT and GATE to a voice. */
export const ghost: ModuleSpec = {
  type: 'ghost',
  title: 'GHOST',
  name: 'Ghost (Call & Response)',
  tagline: 'Learns your phrasing as you play, then answers back in your style when you pause',
  category: 'Sequencing',
  hp: 16,
  panel: BLACK,
  inputs: [
    { id: 'voct', label: 'V/OCT' },
    { id: 'gate', label: 'GATE' },
  ],
  outputs: [
    { id: 'voct', label: 'V/OCT' },
    { id: 'gate', label: 'GATE' },
    { id: 'turn', label: 'MY TURN' },
  ],
  params: [
    { id: 'wait', label: 'WAIT', min: 0.3, max: 4, def: 1.2, curve: 'exp', unit: 's' },
    { id: 'length', label: 'ANSWER', min: 2, max: 16, def: 6, stepped: true },
    { id: 'temper', label: 'TEMPER', min: 0, max: 1, def: 0.4, unit: '%' },
    { id: 'memory', label: 'MEMORY', min: 0.5, max: 1, def: 0.92, unit: '%' },
  ],
  leds: 3,
  controls: [
    { kind: 'surface', name: 'ghost', x: 4, y: 15, w: 73.3, h: 44 },
    ...['wait', 'length', 'temper', 'memory'].map((param, i) => ({ kind: 'knob' as const, param, x: 12 + i * 18.4, y: 70, size: 'S' as const })),
    { kind: 'in', jack: 'voct', x: 12, y: 92 },
    { kind: 'in', jack: 'gate', x: 26, y: 92 },
    { kind: 'out', jack: 'turn', x: 68, y: 98.9 },
    { kind: 'out', jack: 'voct', x: 40, y: 113.5 },
    { kind: 'out', jack: 'gate', x: 54, y: 113.5 },
  ],
}
