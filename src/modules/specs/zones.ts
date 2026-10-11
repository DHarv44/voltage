import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLACK } from './panels'

export const ZN_SOURCES = ['TINE PIANO', 'OWN']
/** AUTO's spacing between sampled notes (semitones). */
export const ZN_EVERY = [2, 3, 4, 6, 12]
/** The longest multisample AUTO will make (seconds of takes). */
export const ZN_MAX_S = 90
export const ZN_VOICES = 8
/** TINE PIANO's layout: notes from 36 every 6 semitones, two velocity layers, two round robins. */
export const ZN_FACTORY = { lo: 36, every: 6, roots: 11, layers: 2, rr: 2 } as const
/** The screen's keyboard (MIDI notes). */
export const ZN_KEYS_LO = 24
export const ZN_KEYS_HI = 108
/** LEDs: state (0 idle, 1 sampling, 2 too long to sample), progress (0..1),
 *  the take being sampled (−1), then each voice's zone (layer × roots +
 *  root index, −1 silent). */
export const ZNL = { state: 0, progress: 1, take: 2, voice0: 3 } as const

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'src', label: 'SOURCE', min: 0, max: 1, def: 0, stepped: true, options: ZN_SOURCES },
  { id: 'tune', label: 'TUNE', min: -12, max: 12, def: 0, unit: 'st' },
  { id: 'att', label: 'ATTACK', min: 0.001, max: 2, def: 0.002, curve: 'exp', unit: 's' },
  { id: 'rel', label: 'RELEASE', min: 0.01, max: 4, def: 0.4, curve: 'exp', unit: 's' },
  { id: 'tone', label: 'TONE', min: 200, max: 20000, def: 14000, curve: 'exp', unit: 'Hz' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'lo', label: 'LOWEST', min: 24, max: 96, def: 36, stepped: true },
  { id: 'hi', label: 'HIGHEST', min: 24, max: 108, def: 84, stepped: true },
  { id: 'every', label: 'EVERY', min: 0, max: ZN_EVERY.length - 1, def: 3, stepped: true, options: ZN_EVERY.map((n) => `${n} st`) },
  { id: 'layers', label: 'LAYERS', min: 1, max: 4, def: 2, stepped: true },
  { id: 'rr', label: 'ROUND ROBIN', min: 1, max: 3, def: 1, stepped: true },
  { id: 'hold', label: 'HOLD', min: 0.1, max: 4, def: 1, curve: 'exp', unit: 's' },
  { id: 'tail', label: 'TAIL', min: 0, max: 3, def: 0.6, unit: 's' },
  // the map of the OWN multisample (written by AUTO, kept with the patch)
  { id: 'mlo', label: 'OWN LOWEST', min: 0, max: 127, def: 0, stepped: true },
  { id: 'mevery', label: 'OWN EVERY', min: 1, max: 12, def: 1, stepped: true },
  { id: 'mroots', label: 'OWN NOTES', min: 0, max: 64, def: 0, stepped: true },
  { id: 'mlayers', label: 'OWN LAYERS', min: 0, max: 4, def: 0, stepped: true },
  { id: 'mrr', label: 'OWN ROUND ROBIN', min: 0, max: 3, def: 0, stepped: true },
  { id: 'mlen', label: 'OWN TAKE LENGTH', min: 0, max: 8, def: 0, unit: 's' },
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'voct', label: 'V/OCT', poly: true },
  { id: 'gate', label: 'GATE', poly: true },
  { id: 'vel', label: 'VEL', poly: true },
  { id: 'in', label: 'IN' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'cvo', label: 'CV' },
  { id: 'gto', label: 'GATE' },
  { id: 'vlo', label: 'VEL' },
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]

const HP = 36
const W = HP * HP_MM
const layout = packRows(
  [
    [{ kind: 'switch', param: 'src', x: 0, y: 0 }, knob('tune'), knob('att'), knob('rel'), knob('tone'), knob('level')],
    [knob('lo'), knob('hi'), knob('every'), knob('layers'), knob('rr'), knob('hold'), knob('tail'), { kind: 'button', name: 'auto', x: 0, y: 0, label: 'AUTO', led: ZNL.state, ledColor: '#ff3b2f' }],
    [jack('in', 'voct'), jack('in', 'gate'), jack('in', 'vel'), jack('in', 'in'), jack('out', 'cvo'), jack('out', 'gto'), jack('out', 'vlo'), jack('out', 'l'), jack('out', 'r')],
  ],
  { params, inputs, outputs },
  W,
  { gap: 1.6 },
)

/** ZONES: a multisample instrument. Every note of the keyboard plays the
 *  recording made nearest it, from the velocity layer its velocity picks,
 *  taking turns between round-robin takes so repeated notes don't sound
 *  like a machine gun. TINE PIANO is the factory multisample (eleven notes ×
 *  two layers × two takes, the soft layer mellow, the hard one barking).
 *  AUTO samples your own: patch CV, GATE and VEL to a voice in the rack and
 *  the voice back into IN, and it plays the voice note by note from LOWEST
 *  to HIGHEST, every EVERY semitones, at each velocity layer and round
 *  robin, holding each note for HOLD and recording its TAIL, then plays the
 *  rack voice back as a multisample. */
export const zones: ModuleSpec = {
  type: 'zones',
  title: 'ZONES',
  name: 'Zones (Multisampler)',
  tagline: 'A multisample instrument: zones, velocity layers and round robins; AUTO samples a voice in your rack note by note and plays it back',
  category: 'Sampling & Tape',
  hp: HP,
  panel: BLACK,
  inputs,
  outputs,
  params,
  leds: ZNL.voice0 + ZN_VOICES,
  controls: [{ kind: 'surface', name: 'zones', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
