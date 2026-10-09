import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { SLATE } from './panels'

/** Up to this many notes, each four params: start step (−1 = empty), length
 *  (steps), note (semitones up from C2) and velocity. */
export const PR_SLOTS = 96
export const PR_STEPS_PER_BAR = 16
export const PR_MAX_BARS = 4
export const PR_ROWS = 48
/** Rows on screen; VIEW is the lowest one shown. */
export const PR_SHOWN = 30
/** LEDs: the step playing (−1 stopped), then each voice's sounding note (−1 none). */
export const PRL = { step: 0, voice0: 1 } as const

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

/** A note from bar.step (1-based, as you'd count it) for the factory part. */
type N = [start: number, len: number, note: number, vel?: number]
/** The factory part, in A minor: Am – F – C – G held a bar each (voiced
 *  close, around middle C) with a melody on top. */
const FACTORY: N[] = [
  // chords: A C E, F A C, G C E (C/G), G B D
  ...[21, 24, 28].map((n): N => [0, 16, n, 0.6]),
  ...[17, 21, 24].map((n): N => [16, 16, n, 0.6]),
  ...[19, 24, 28].map((n): N => [32, 16, n, 0.6]),
  ...[19, 23, 26].map((n): N => [48, 16, n, 0.6]),
  // the melody: E D C B · A … C D E · G E D · D C B
  [0, 4, 40], [4, 2, 38], [6, 2, 36], [8, 8, 35],
  [16, 6, 33], [22, 2, 36], [24, 4, 38], [28, 4, 40],
  [32, 6, 43], [38, 2, 40], [40, 8, 38],
  [48, 4, 38], [52, 4, 36], [56, 8, 35],
]

const slotParams: ParamSpec[] = Array.from({ length: PR_SLOTS }, (_, i): ParamSpec[] => {
  const f = FACTORY[i]
  return [
    { id: `s${i}`, label: `START ${i + 1}`, min: -1, max: PR_STEPS_PER_BAR * PR_MAX_BARS - 1, def: f ? f[0] : -1, stepped: true },
    { id: `l${i}`, label: `LENGTH ${i + 1}`, min: 1, max: PR_STEPS_PER_BAR * PR_MAX_BARS, def: f ? f[1] : 1, stepped: true },
    { id: `n${i}`, label: `NOTE ${i + 1}`, min: 0, max: PR_ROWS - 1, def: f ? f[2] : 24, stepped: true },
    { id: `v${i}`, label: `VELOCITY ${i + 1}`, min: 0, max: 1, def: f ? (f[3] ?? 0.85) : 0.85 },
  ]
}).flat()

const prParams: ParamSpec[] = [
  { id: 'tempo', label: 'BPM', min: 40, max: 220, def: 92, unit: 'bpm' },
  { id: 'bars', label: 'BARS', min: 1, max: PR_MAX_BARS, def: 4, stepped: true },
  { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
  { id: 'voices', label: 'VOICES', min: 1, max: 8, def: 6, stepped: true },
  { id: 'swing', label: 'SWING', min: 0, max: 0.5, def: 0, unit: '%' },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  { id: 'view', label: 'VIEW', min: 0, max: PR_ROWS - PR_SHOWN, def: 15, stepped: true },
  ...slotParams,
]
const prIn: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
  { id: 'trans', label: 'TRANSPOSE' },
]
const prOut: ModuleSpec['outputs'] = [
  { id: 'pitch', label: '1V/OCT', poly: true },
  { id: 'gate', label: 'GATE', poly: true },
  { id: 'vel', label: 'VEL', poly: true },
  { id: 'eol', label: 'EOL' },
]

/** A piano roll: draw notes on a grid (time across, pitch up), as long as you
 *  like and as many at once as you like. They come out on poly cables (one
 *  voice per note sounding), so it plays chords into the poly modules, or its
 *  first voice into anything mono. Its own tempo, or 16ths on CLK. */
export const pianoroll: ModuleSpec = {
  type: 'pianoroll',
  title: 'PIANO ROLL',
  name: 'Piano Roll',
  tagline: 'Draw notes on a grid, chords and all, up to four bars; poly pitch, gate and velocity out; its own tempo or 16ths on CLK',
  category: 'Sequencers',
  hp: 36,
  panel: SLATE,
  inputs: prIn,
  outputs: prOut,
  params: prParams,
  leds: 1 + 8,
  controls: (() => {
    const w = 36 * HP_MM
    const { controls, top } = packRows(
      [[knob('tempo'), knob('bars'), knob('oct'), knob('voices'), knob('swing'), { kind: 'switch', param: 'run', x: 0, y: 0 }, jack('in', 'clk'), jack('in', 'rst'), jack('in', 'trans'), jack('out', 'pitch'), jack('out', 'gate'), jack('out', 'vel'), jack('out', 'eol')]],
      { params: prParams, inputs: prIn, outputs: prOut },
      w,
      { gap: 1.6 },
    )
    return [{ kind: 'surface', name: 'pianoroll', x: 4, y: 14, w: w - 8, h: top - BEZEL - 1.5 - 14 } as Control, ...controls]
  })(),
}
