import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLACK } from './panels'

/** The instruments GRAND can be. Each is the same physics with different
 *  numbers (see GRAND_MODELS). */
export const GRAND_MODEL_NAMES = ['GRAND', 'UPRIGHT', 'HONKY']

/** One instrument's physics:
 *  - b4: string stiffness at C4 (the inharmonicity B: partial n sits at
 *    n·√(1 + B·n²) times the note), and how much it grows per octave up;
 *  - ring: how long C4's fundamental sounds (s to −60 dB) with DECAY at noon;
 *  - unison: how far apart (cents) the two or three strings of a note sit
 *    with UNISON at noon (a honky-tonk is tuned wide on purpose);
 *  - body: the soundboard's main resonances (Hz) and how boxy it is (Q);
 *  - knock: how loud the action is (key and hammer noise). */
export interface GrandModel {
  b4: number
  bPerOct: number
  ring: number
  unison: number
  body: [number, number, number]
  bodyQ: number
  knock: number
}
export const GRAND_MODELS: GrandModel[] = [
  { b4: 0.0004, bPerOct: 1.1, ring: 14, unison: 0.6, body: [95, 230, 520], bodyQ: 0.9, knock: 0.25 },
  { b4: 0.0009, bPerOct: 1.15, ring: 8, unison: 0.9, body: [130, 300, 700], bodyQ: 1.4, knock: 0.45 },
  { b4: 0.0009, bPerOct: 1.15, ring: 7, unison: 9, body: [130, 300, 700], bodyQ: 1.4, knock: 0.5 },
]

const params: ParamSpec[] = [
  { id: 'model', label: 'MODEL', min: 0, max: GRAND_MODEL_NAMES.length - 1, def: 0, stepped: true, options: GRAND_MODEL_NAMES },
  { id: 'bright', label: 'BRIGHT', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'decay', label: 'DECAY', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'unison', label: 'UNISON', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'body', label: 'BODY', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'hammer', label: 'HAMMER', min: 0, max: 1, def: 0.4, unit: '%' },
  { id: 'width', label: 'WIDTH', min: 0, max: 1, def: 0.6, unit: '%' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'vel', label: 'VEL' },
  { id: 'sus', label: 'SUS' },
  { id: 'soft', label: 'SOFT' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]
const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'M' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const W = 20 * HP_MM
const layout = packRows(
  [
    ['model', 'bright', 'decay', 'unison'].map(knob),
    ['body', 'hammer', 'width', 'level'].map(knob),
    [jack('in', 'voct'), jack('in', 'gate'), jack('in', 'vel'), null],
    [jack('in', 'sus'), jack('in', 'soft'), jack('out', 'l'), jack('out', 'r')],
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 9 },
)

/** An acoustic piano, physically modelled, eight notes. Each note is its
 *  strings' partials (stiff strings, so each overtone sits a little sharp:
 *  the piano's own sound), two or three strings a few cents apart (the
 *  beating, and the fast-then-slow decay), struck by a felt hammer whose
 *  contact time shapes the tone (soft blows round, hard ones bright), into a
 *  soundboard. SUS lifts the dampers (and the undamped strings ring in
 *  sympathy); SOFT is the una corda. Plays from the keys when GATE is empty. */
export const grand: ModuleSpec = {
  type: 'grand',
  title: 'GRAND',
  name: 'Acoustic Piano',
  tagline: 'Modelled acoustic piano, 8 notes: grand, upright or honky-tonk; stiff-string partials, detuned unisons, felt hammer, soundboard, sustain pedal with sympathetic strings, una corda',
  category: 'Polyphonic',
  hp: 20,
  panel: BLACK,
  inputs,
  outputs,
  params,
  leds: 8,
  controls: [...layout.controls, ...Array.from({ length: 8 }, (_, v): Control => ({ kind: 'led', index: v, x: W / 2 + (v - 3.5) * 7, y: layout.top - 7, color: '#e8a33d' }))],
}
