import type { ModuleSpec } from '../types'
import { RED } from './panels'

export const THL = {
  /** Hand proximity to the pitch rod 0..1 and to the volume loop 0..1. */
  pitchHand: 0,
  volHand: 1,
  /** Sounding pitch in V/oct (0 V = C4), for the note readout. */
  volts: 2,
  /** Output loudness 0..1. */
  level: 3,
} as const

const KX = [10, 25.5, 40.6, 56, 71]
const OX = [12, 31, 50, 69]

/** Heterodyne theremin. Hover over it: distance to the rod is pitch (the notes
 *  crowd together near the rod, as on a real one), height over the loop is
 *  volume (near the loop = quiet). Move the pointer away and your hand rests on
 *  the loop. SNAP pulls toward the nearest semitone like a Theremini. */
export const theremin: ModuleSpec = {
  type: 'theremin',
  title: 'THEREMIN',
  name: 'Theremin',
  tagline: 'Play it without touching: hover for pitch and volume. Heterodyne tone, pitch-snap, CV outs',
  category: 'Sources',
  hp: 16,
  panel: RED,
  inputs: [],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'pitch', label: 'PITCH' },
    { id: 'vol', label: 'VOL' },
    { id: 'gate', label: 'GATE' },
  ],
  params: [
    { id: 'tune', label: 'PITCH', min: -2, max: 1, def: -1, unit: 'oct' },
    { id: 'range', label: 'RANGE', min: 1, max: 5, def: 3, unit: 'oct' },
    { id: 'timbre', label: 'TIMBRE', min: 0, max: 1, def: 0.35, unit: '%' },
    { id: 'snap', label: 'SNAP', min: 0, max: 1, def: 0, unit: '%' },
    { id: 'vol', label: 'VOLUME', min: 0, max: 1, def: 0.8, unit: '%' },
  ],
  leds: 4,
  controls: [
    { kind: 'surface', name: 'theremin', x: 4, y: 15, w: 73.3, h: 66 },
    ...['tune', 'range', 'timbre', 'snap', 'vol'].map((param, i) => ({ kind: 'knob' as const, param, x: KX[i], y: 90, size: 'S' as const })),
    ...['out', 'pitch', 'vol', 'gate'].map((jack, i) => ({ kind: 'out' as const, jack, x: OX[i], y: 114 })),
  ],
}
