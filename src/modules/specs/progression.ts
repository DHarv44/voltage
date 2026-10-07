import type { ModuleSpec } from '../types'
import { CREAM } from './panels'
import { KEY_NAMES } from './tune'

/** LED layout: the last few chords (degree index, quality) for the display. */
export const PROGL = { history: 0, count: 6 } as const

/** Chord progressions by the rules of common-practice harmony. Each change
 *  (CLK, or every BARS at TEMPO) picks the next chord the way a songwriter
 *  would: tonic → predominant → dominant → home, with deceptive cadences and
 *  side-steps. MOOD adds sevenths and borrowed chords from the parallel minor.
 *  NOTES carries the chord on a poly cable, voice-led (each voice moves as
 *  little as it can); ROOT is the bass note; FUNC says tonic / pre-dominant /
 *  dominant as 0 / 5 / 10 V. */
export const progression: ModuleSpec = {
  type: 'progression',
  title: 'PROGRESSION',
  name: 'Chord Progression Generator',
  tagline: 'Harmony-rule chord progressions, voice-led on a poly cable, with root and function outs',
  category: 'Brains',
  hp: 14,
  panel: CREAM,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'home', label: 'HOME' },
  ],
  outputs: [
    { id: 'notes', label: 'NOTES', poly: true },
    { id: 'root', label: 'ROOT' },
    { id: 'gate', label: 'CHANGE' },
    { id: 'func', label: 'FUNC' },
  ],
  params: [
    { id: 'key', label: 'KEY', min: 0, max: 11, def: 0, stepped: true, options: KEY_NAMES },
    { id: 'mode', label: 'MODE', min: 0, max: 1, def: 0, stepped: true, options: ['MAJOR', 'MINOR'] },
    { id: 'mood', label: 'MOOD', min: 0, max: 1, def: 0.3, unit: '%' },
    { id: 'tempo', label: 'TEMPO', min: 40, max: 200, def: 96, unit: 'bpm' },
    { id: 'bars', label: 'BARS', min: 1, max: 4, def: 1, stepped: true },
  ],
  leds: 12,
  controls: [
    { kind: 'surface', name: 'progression', x: 5, y: 15, w: 61, h: 26 },
    { kind: 'knob', param: 'key', x: 14, y: 52 },
    { kind: 'switch', param: 'mode', x: 35.5, y: 52 },
    { kind: 'knob', param: 'mood', x: 57, y: 52 },
    { kind: 'knob', param: 'tempo', x: 22, y: 73, size: 'S' },
    { kind: 'knob', param: 'bars', x: 49, y: 73, size: 'S' },
    { kind: 'in', jack: 'clk', x: 12, y: 93 },
    { kind: 'in', jack: 'home', x: 26, y: 93 },
    ...['notes', 'root', 'gate', 'func'].map((jack, i) => ({ kind: 'out' as const, jack, x: 12 + i * 15.7, y: 113.5 })),
  ],
}
