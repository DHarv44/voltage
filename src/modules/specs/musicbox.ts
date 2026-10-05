import type { ModuleSpec, ParamSpec } from '../types'
import { SAND } from './panels'

/** 15-note comb, C major from C4 (semitones), and the strip length. */
export const MB_NOTES = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24]
export const MB_STEPS = 32
export const MBL = {
  /** Strip position in steps (0..MB_STEPS). */
  pos: 0,
  /** Last plucked tine (−1 none) and a decaying flash. */
  tine: 1,
  flash: 2,
  /** Crank angle (revolutions mod 1). */
  crank: 3,
} as const

/** Twinkle Twinkle (traditional), punched with a simple bass line. */
const MELODY: [number, number][] = [
  [0, 7], [2, 7], [4, 11], [6, 11], [8, 12], [10, 12], [12, 11],
  [16, 10], [18, 10], [20, 9], [22, 9], [24, 8], [26, 8], [28, 7],
]
const BASS: [number, number][] = [
  [0, 0], [4, 4], [8, 3], [12, 0], [16, 3], [20, 0], [24, 4], [28, 0],
]
function defaultMasks(): number[] {
  const m = new Array<number>(MB_NOTES.length).fill(0)
  for (const [step, row] of [...MELODY, ...BASS]) m[row] |= 2 ** step
  return m.map((v) => v >>> 0)
}
const MASKS = defaultMasks()

const ROW_PARAMS: ParamSpec[] = MB_NOTES.map((_, r) => ({
  id: `r${r}`,
  label: `ROW ${r + 1}`,
  min: 0,
  max: 2 ** MB_STEPS - 1,
  def: MASKS[r],
  stepped: true,
}))

// one 18 mm column grid for knobs, switch and jacks
const KX = [12, 30, 48, 66]
const IX = [12, 30]
const OX = [48, 66, 84, 102]

/** Paper-strip music box. Turn the crank (drag round it) or let the spring
 *  motor play; click the strip to punch or fill holes. Each tine is a tuned
 *  steel cantilever: inharmonic partials, the upper ones dying fast, and a
 *  tine re-plucked while ringing is damped first (the little squeak). */
export const musicbox: ModuleSpec = {
  type: 'musicbox',
  title: 'MUSIC BOX',
  name: 'Music Box',
  tagline: '15-note paper-strip music box: crank it or wind it, punch your own strip, steel-comb tines',
  category: 'Sources',
  hp: 24,
  panel: SAND,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RESET' },
  ],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'gate', label: 'GATE' },
    { id: 'pitch', label: 'PITCH' },
    { id: 'step', label: 'STEP' },
  ],
  params: [
    { id: 'motor', label: 'DRIVE', min: 0, max: 1, def: 1, stepped: true, options: ['CRANK', 'MOTOR'] },
    { id: 'tempo', label: 'TEMPO', min: 0.5, max: 12, def: 4, curve: 'exp', unit: 'x' },
    { id: 'decay', label: 'RING', min: 0.3, max: 6, def: 2.5, curve: 'exp', unit: 's' },
    { id: 'tone', label: 'BODY', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
    ...ROW_PARAMS,
  ],
  leds: 4,
  controls: [
    { kind: 'surface', name: 'musicbox', x: 4, y: 15, w: 113.9, h: 68 },
    ...['tempo', 'decay', 'tone', 'level'].map((param, i) => ({ kind: 'knob' as const, param, x: KX[i], y: 93, size: 'S' as const })),
    { kind: 'switch', param: 'motor', x: 84, y: 93 },
    ...['clk', 'rst'].map((jack, i) => ({ kind: 'in' as const, jack, x: IX[i], y: 114 })),
    ...['out', 'gate', 'pitch', 'step'].map((jack, i) => ({ kind: 'out' as const, jack, x: OX[i], y: 114 })),
  ],
}
