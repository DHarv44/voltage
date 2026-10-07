import type { ModuleSpec } from '../types'
import { BLUE } from './panels'

/** The circle of fifths, clockwise from the top: major keys on the outer
 *  ring, their relative minors inside, and the diminished chord of each key
 *  innermost (the classic chord-wheel layout). */
export const WHEEL_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F']
export const WHEEL_MINOR = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'D♯m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm']
export const WHEEL_DIM = ['B°', 'F♯°', 'C♯°', 'G♯°', 'D♯°', 'A♯°', 'E♯°', 'C°', 'G°', 'D°', 'A°', 'E°']
/** Pitch class of position i's major chord (C = 0): a fifth per step. */
export const wheelPc = (i: number) => (i * 7) % 12

/** Telemetry slots. */
export const CWL = {
  key: 0,
  /** Pressed (or last) chord: ring (0 major, 1 minor, 2 dim) and position; −1 none. */
  ring: 1,
  pos: 2,
  held: 3,
  seventh: 4,
} as const

const OX = [16, 40, 64, 88, 112, 136]

/** Chord wheel: a circle-of-fifths chord controller. Hold a chord to play it;
 *  slide across the wheel to change chords without lifting. The current key's
 *  wedge (IV I V, ii vi iii, vii°) is lit. Plays a soft built-in pad, and sends
 *  the chord on a poly cable with its root, bass, gate and a trigger per change. */
export const chordwheel: ModuleSpec = {
  type: 'chordwheel',
  title: 'CHORD WHEEL',
  name: 'Chord Wheel',
  tagline: 'Circle-of-fifths chord controller: majors, relative minors and diminished; chord on a poly cable + built-in pad',
  category: 'Instruments',
  hp: 30,
  panel: BLUE,
  inputs: [],
  outputs: [
    { id: 'out', label: 'PAD' },
    { id: 'notes', label: 'NOTES', poly: true },
    { id: 'root', label: 'ROOT' },
    { id: 'bass', label: 'BASS' },
    { id: 'gate', label: 'GATE' },
    { id: 'trig', label: 'TRIG' },
  ],
  params: [
    { id: 'key', label: 'KEY', min: 0, max: 11, def: 0, stepped: true, options: WHEEL_MAJOR },
    { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
    { id: 'voicing', label: 'VOICING', min: 0, max: 1, def: 0, stepped: true, options: ['CLOSE', 'OPEN'] },
    { id: 'level', label: 'PAD', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'tone', label: 'TONE', min: 0, max: 1, def: 0.4, unit: '%' },
  ],
  leds: 5,
  controls: [
    { kind: 'surface', name: 'chordwheel', x: 6, y: 14, w: 90, h: 90, bare: true },
    // knobs in a column beside the wheel: KEY + OCTAVE, VOICING + PAD, TONE
    ...['key', 'oct', 'voicing', 'level', 'tone'].map((param, i) => ({
      kind: 'knob' as const,
      param,
      x: i === 4 ? 124 : i % 2 ? 136 : 112,
      y: 30 + Math.floor(i / 2) * 26,
      size: 'S' as const,
    })),
    ...['out', 'notes', 'root', 'bass', 'gate', 'trig'].map((jack, i) => ({ kind: 'out' as const, jack, x: OX[i], y: 116 })),
  ],
}
