import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { CREAM, SAGE, SLATE } from './panels'

export const CLICK_NAMES = ['TICK', 'WOOD', 'CLAVE', 'BEEP']
export const SUBDIVS = ['—', '8THS', 'TRIPS', '16THS']
/** Clicks per beat for each SUBDIV. */
export const SUBDIV_N = [1, 2, 3, 4]

const opt = (id: string, label: string, options: string[], def: number): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })
const knob = (param: string, size: 'S' | 'M' | 'L' = 'S'): Control => ({ kind: 'knob', param, x: 0, y: 0, size })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const SURFACE_Y = 14

/** A surface over everything above the packed rows. */
function panel(hp: number, rows: (Control | null)[][], spec: Pick<ModuleSpec, 'params' | 'inputs' | 'outputs'>, name: string) {
  const W = hp * HP_MM
  const layout = packRows(rows, spec, W, { gap: 2.4 })
  return [{ kind: 'surface' as const, name, x: 4, y: SURFACE_Y, w: W - 8, h: layout.top - SURFACE_Y - 3 }, ...layout.controls]
}

// ---- METRONOME: the plain one ----

/** LEDs: the beat in the bar (−1 stopped), a click flash, the tempo it's following (0 = its own). */
export const METL = { beat: 0, flash: 1, bpm: 2 } as const

const metParams: ParamSpec[] = [
  { id: 'bpm', label: 'TEMPO', min: 20, max: 300, def: 100, curve: 'exp', unit: 'bpm' },
  { id: 'beats', label: 'BEATS', min: 1, max: 12, def: 4, stepped: true },
  opt('sub', 'SUBDIV', SUBDIVS, 0),
  opt('sound', 'SOUND', CLICK_NAMES, 0),
  { id: 'accent', label: 'ACCENT', min: 0, max: 1, def: 0.7, unit: '%' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.6, unit: '%' },
  opt('run', 'RUN', ['STOP', 'RUN'], 1),
]
const metIn: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'run', label: 'RUN' },
  { id: 'rst', label: 'RST' },
]
const metOut: ModuleSpec['outputs'] = [
  { id: 'beat', label: 'BEAT' },
  { id: 'bar', label: 'BAR' },
  { id: 'sub', label: 'SUB' },
  { id: 'rsto', label: 'RST' },
  { id: 'out', label: 'OUT' },
]

/** A metronome: a click on every beat, beat 1 accented (higher and louder),
 *  optional 8ths / triplets / 16ths in between. Its own TEMPO (tap the
 *  screen to set it), or it follows CLK in 16ths, as everything else does. */
export const metronome: ModuleSpec = {
  type: 'metronome',
  title: 'METRONOME',
  name: 'Metronome',
  tagline: 'A click on every beat, beat 1 accented; subdivisions; tap tempo; follows CLK',
  category: 'Sequencers',
  hp: 12,
  panel: SLATE,
  inputs: metIn,
  outputs: metOut,
  params: metParams,
  leds: 3,
  controls: panel(
    12,
    [
      [knob('bpm', 'L'), knob('beats', 'M')],
      [knob('sub'), knob('sound'), knob('accent'), knob('level')],
      [sw('run'), jack('in', 'clk'), jack('in', 'run'), jack('in', 'rst'), jack('out', 'rsto')],
      ['beat', 'bar', 'sub', 'out'].map((id) => jack('out', id)),
    ],
    { params: metParams, inputs: metIn, outputs: metOut },
    'metronome',
  ),
}

// ---- MAELZEL: the wind-up pendulum ----

export const MAELZEL_BELLS = ['OFF', '2', '3', '4', '6']
export const MAELZEL_BELL_N = [0, 2, 3, 4, 6]
/** LEDs: pendulum angle (rad), spring (0..1), tick and bell flashes, the beat in the bar. */
export const MZL = { angle: 0, spring: 1, tick: 2, bell: 3, beat: 4 } as const
/** The swing a full spring keeps up (radians), and the SWING out's scale (volts per radian). */
export const MZ_SWING = 0.6
export const MZ_VOLTS = 5 / MZ_SWING

const mzParams: ParamSpec[] = [
  { id: 'bpm', label: 'TEMPO', min: 40, max: 208, def: 96, curve: 'exp', unit: 'bpm' },
  opt('bell', 'BELL', MAELZEL_BELLS, 0),
  { id: 'tilt', label: 'TILT', min: -1, max: 1, def: 0, unit: '%' },
  { id: 'couple', label: 'PLANK', min: 0, max: 1, def: 0.4, unit: '%' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.6, unit: '%' },
  opt('run', 'RUN', ['STOP', 'GO'], 1),
  opt('spring', 'SPRING', ['WIND-UP', 'ELECTRIC'], 0),
]
const mzIn: ModuleSpec['inputs'] = [
  { id: 'plank', label: 'PLANK' },
  { id: 'rst', label: 'RST' },
]
const mzOut: ModuleSpec['outputs'] = [
  { id: 'tick', label: 'TICK' },
  { id: 'bell', label: 'BELL' },
  { id: 'swing', label: 'SWING' },
  { id: 'rsto', label: 'RST' },
  { id: 'out', label: 'OUT' },
]

/** A clockwork pendulum metronome, simulated: the sliding weight sets the
 *  swing (drag it, or turn TEMPO), the escapement ticks as the rod passes
 *  the middle and gives it a little push from the spring. WIND-UP runs down
 *  over a few minutes (the swing shrinks, then stops; click the key to wind
 *  it); TILT stands it off level so tick and tock come unevenly (swing).
 *  SWING out is the rod's angle; patch it into another MAELZEL's PLANK and
 *  the two, like metronomes on a shared plank, slowly fall into step. */
export const maelzel: ModuleSpec = {
  type: 'maelzel',
  title: 'MAELZEL',
  name: 'Wind-up Metronome',
  tagline: 'A clockwork pendulum metronome: winds down, ticks unevenly off level, falls into step with another on a shared plank',
  category: 'Sequencers',
  hp: 16,
  panel: CREAM,
  inputs: mzIn,
  outputs: mzOut,
  params: mzParams,
  leds: 5,
  controls: panel(
    16,
    [
      [knob('bpm', 'M'), knob('bell'), knob('tilt'), knob('couple'), knob('level')],
      [sw('run'), sw('spring'), jack('in', 'plank'), jack('in', 'rst')],
      mzOut.map((j) => jack('out', j.id)),
    ],
    { params: mzParams, inputs: mzIn, outputs: mzOut },
    'maelzel',
  ),
}

// ---- COACH: the practice metronome ----

export const COACH_POLY = ['OFF', '2', '3', '5', '7']
export const COACH_POLY_N = [0, 2, 3, 5, 7]
/** LEDs: tempo now, bars played, beat in bar (−1 stopped), in a gap, click
 *  flash, the poly click's flash, how far the ramp has come (0..1). */
export const COL = { bpm: 0, bar: 1, beat: 2, gap: 3, flash: 4, poly: 5, ramp: 6 } as const

const coParams: ParamSpec[] = [
  { id: 'start', label: 'START', min: 40, max: 240, def: 90, unit: 'bpm', stepped: true },
  { id: 'target', label: 'TARGET', min: 40, max: 240, def: 120, unit: 'bpm', stepped: true },
  { id: 'step', label: 'STEP', min: 0, max: 10, def: 4, unit: 'bpm', stepped: true },
  { id: 'every', label: 'EVERY', min: 1, max: 16, def: 2, stepped: true },
  opt('sound', 'SOUND', CLICK_NAMES, 1),
  { id: 'beats', label: 'BEATS', min: 1, max: 12, def: 4, stepped: true },
  { id: 'play', label: 'PLAY', min: 1, max: 8, def: 2, stepped: true },
  { id: 'gap', label: 'GAP', min: 0, max: 8, def: 0, stepped: true },
  opt('poly', 'POLY', COACH_POLY, 0),
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.6, unit: '%' },
  opt('run', 'RUN', ['STOP', 'RUN'], 1),
]
const coIn: ModuleSpec['inputs'] = [
  { id: 'run', label: 'RUN' },
  { id: 'rst', label: 'RST' },
]
const coOut: ModuleSpec['outputs'] = [
  { id: 'x4', label: '1/16' },
  { id: 'beat', label: 'BEAT' },
  { id: 'bar', label: 'BAR' },
  { id: 'poly', label: 'POLY' },
  { id: 'rsto', label: 'RST' },
  { id: 'out', label: 'OUT' },
]

/** A practice metronome. SPEED TRAINER: from START it climbs (or falls) STEP
 *  bpm every EVERY bars until TARGET. GAP CLICK: PLAY bars of click, then GAP
 *  bars of silence (keep time yourself; does the click come back with you?).
 *  POLY lays N even clicks across each bar against the beat (3 over 4…).
 *  1/16 out carries the climbing tempo, so a drum machine can practise too. */
export const coach: ModuleSpec = {
  type: 'coach',
  title: 'COACH',
  name: 'Practice Metronome',
  tagline: 'Speed trainer (climbs to a target tempo), gap click (silent bars), polyrhythm click; clocks the rack',
  category: 'Sequencers',
  hp: 16,
  panel: SAGE,
  inputs: coIn,
  outputs: coOut,
  params: coParams,
  leds: 7,
  controls: panel(
    16,
    [
      [knob('start', 'M'), knob('target', 'M'), knob('step'), knob('every'), knob('sound')],
      [knob('beats'), knob('play'), knob('gap'), knob('poly'), knob('level')],
      [sw('run'), jack('in', 'run'), jack('in', 'rst')],
      coOut.map((j) => jack('out', j.id)),
    ],
    { params: coParams, inputs: coIn, outputs: coOut },
    'coach',
  ),
}
