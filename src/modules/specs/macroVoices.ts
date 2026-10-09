import type { Control, ModuleSpec, ParamSpec } from '../types'
import { BLUE, GREEN } from './panels'
import { rows } from './stereoTools'

const knob = (param: string, size: 'S' | 'M' = 'S'): Control => ({ kind: 'knob', param, x: 0, y: 0, size })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

// ---- KALEIDO: a macro oscillator ----

/** KALEIDO's models, in MODEL order. HARMONICS / TIMBRE / MORPH mean
 *  something different in each (see KALEIDO_KNOBS). */
export const KALEIDO_MODELS = ['VA', 'FOLD', 'FM', 'VOWEL', 'ADDITIVE', 'CHORD', 'STRING', 'MODAL']
/** What the three macro knobs do in each model. */
export const KALEIDO_KNOBS: [string, string, string][] = [
  ['interval', 'pulse width', 'saw ↔ pulse'],
  ['second harmonic', 'fold amount', 'asymmetry'],
  ['ratio', 'FM amount', 'feedback'],
  ['throat size', 'vowel', 'breath'],
  ['centre harmonic', 'bandwidth', 'odd ↔ even'],
  ['chord', 'voicing', 'saw ↔ organ'],
  ['pluck position', 'brightness', 'decay'],
  ['inharmonicity', 'brightness', 'decay'],
]

const kParams: ParamSpec[] = [
  { id: 'model', label: 'MODEL', min: 0, max: KALEIDO_MODELS.length - 1, def: 0, stepped: true, options: KALEIDO_MODELS },
  { id: 'tune', label: 'TUNE', min: -24, max: 24, def: 0, unit: 'st' },
  { id: 'harm', label: 'HARMONICS', min: 0, max: 1, def: 0.3, unit: '%' },
  { id: 'timbre', label: 'TIMBRE', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'morph', label: 'MORPH', min: 0, max: 1, def: 0.3, unit: '%' },
  { id: 'decay', label: 'DECAY', min: 0.03, max: 3, def: 0.5, curve: 'exp', unit: 's' },
]
const kIn: ModuleSpec['inputs'] = [
  { id: 'voct', label: 'V/OCT' },
  { id: 'trig', label: 'TRIG' },
  { id: 'model', label: 'MODEL' },
  { id: 'harm', label: 'HARMONICS' },
  { id: 'timbre', label: 'TIMBRE' },
  { id: 'morph', label: 'MORPH' },
]
const kOut: ModuleSpec['outputs'] = [
  { id: 'out', label: 'OUT' },
  { id: 'aux', label: 'AUX' },
]

/** A macro oscillator: eight ways of making a sound behind the same three
 *  knobs. TRIG patched: each hit plays a note through a built-in low-pass
 *  gate (DECAY long); STRING and MODAL are struck instead (and, with TRIG
 *  empty, struck by each new note at V/OCT). */
export const kaleido: ModuleSpec = {
  type: 'kaleido',
  title: 'KALEIDO',
  name: 'Macro Oscillator',
  tagline: 'Eight sound models behind three knobs: analog, wavefolder, FM, vowels, additive, chords, plucked string, struck bell; a built-in low-pass gate',
  category: 'Oscillators',
  hp: 14,
  panel: BLUE,
  inputs: kIn,
  outputs: kOut,
  params: kParams,
  controls: rows(
    14,
    [[knob('model', 'M'), knob('tune', 'M')], [knob('harm'), knob('timbre'), knob('morph')], [knob('decay')], [jack('in', 'voct'), jack('in', 'trig'), jack('in', 'model')], [jack('in', 'harm'), jack('in', 'timbre'), jack('in', 'morph')], [jack('out', 'out'), jack('out', 'aux')]],
    { params: kParams, inputs: kIn, outputs: kOut },
    2.6,
  ),
}

// ---- RESONATOR ----

/** MODAL: a struck or bowed object (24 modes); STRINGS: four strings tuned to
 *  a chord, ringing in sympathy; STRING: one plucked string per voice. */
export const RESO_MODELS = ['MODAL', 'STRINGS', 'STRING']
export const RESO_POLY = [1, 2, 4]
/** STRINGS: the chords STRUCTURE steps through (semitones over the note). */
export const RESO_CHORDS = [
  [0, 0, 0, 0],
  [0, 12, 0, 12],
  [0, 7, 12, 19],
  [0, 5, 7, 12],
  [0, 3, 7, 10],
  [0, 4, 7, 11],
  [0, 3, 7, 12],
  [0, 4, 7, 12],
  [0, 2, 7, 14],
]

const rParams: ParamSpec[] = [
  { id: 'model', label: 'MODEL', min: 0, max: RESO_MODELS.length - 1, def: 0, stepped: true, options: RESO_MODELS },
  { id: 'poly', label: 'POLY', min: 0, max: RESO_POLY.length - 1, def: 2, stepped: true, options: RESO_POLY.map(String) },
  { id: 'tune', label: 'TUNE', min: -24, max: 24, def: 0, unit: 'st' },
  { id: 'structure', label: 'STRUCTURE', min: 0, max: 1, def: 0.35, unit: '%' },
  { id: 'bright', label: 'BRIGHTNESS', min: 0, max: 1, def: 0.55, unit: '%' },
  { id: 'damp', label: 'DAMPING', min: 0, max: 1, def: 0.4, unit: '%' },
  { id: 'pos', label: 'POSITION', min: 0, max: 1, def: 0.3, unit: '%' },
]
const rIn: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'strum', label: 'STRUM' },
  { id: 'voct', label: 'V/OCT' },
  { id: 'structure', label: 'STRUCTURE' },
  { id: 'bright', label: 'BRIGHTNESS' },
  { id: 'damp', label: 'DAMPING' },
  { id: 'pos', label: 'POSITION' },
]
const rOut: ModuleSpec['outputs'] = [
  { id: 'odd', label: 'ODD' },
  { id: 'even', label: 'EVEN' },
]

/** A resonator: something to ring. Feed IN (a drum, noise, a voice) and it
 *  rings at the note on V/OCT; or STRUM it on its own. With POLY above 1
 *  each strum takes the next voice while the last rings on. ODD and EVEN
 *  split its modes (or voices) for stereo. */
export const resonator: ModuleSpec = {
  type: 'resonator',
  title: 'RESONATOR',
  name: 'Resonator',
  tagline: 'Makes anything ring: a struck or bowed object, sympathetic strings tuned to chords, plucked strings; up to four voices, stereo out',
  category: 'Effects',
  hp: 14,
  panel: GREEN,
  inputs: rIn,
  outputs: rOut,
  params: rParams,
  controls: rows(
    14,
    [[knob('model'), knob('poly'), knob('tune')], [knob('structure', 'M'), knob('bright', 'M')], [knob('damp'), knob('pos')], [jack('in', 'in'), jack('in', 'strum'), jack('in', 'voct'), jack('in', 'structure')], [jack('in', 'bright'), jack('in', 'damp'), jack('in', 'pos')], [jack('out', 'odd'), jack('out', 'even')]],
    { params: rParams, inputs: rIn, outputs: rOut },
    2.4,
  ),
}
