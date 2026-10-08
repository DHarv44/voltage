import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { FM_ALGO_NAMES, FM_VOICE_NAMES } from './fmPatches'
import { SAGE, SAND } from './panels'

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'M' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

// ---- FM-4 ----
const fmParams: ParamSpec[] = [
  { id: 'voice', label: 'VOICE', min: 0, max: FM_VOICE_NAMES.length - 1, def: 0, stepped: true, options: FM_VOICE_NAMES },
  { id: 'algo', label: 'ALGO', min: 0, max: FM_ALGO_NAMES.length, def: 0, stepped: true, options: ['VOICE', ...FM_ALGO_NAMES] },
  { id: 'tune', label: 'TUNE', min: -24, max: 24, def: 0, stepped: true, unit: 'st' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'bright', label: 'BRIGHT', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'decay', label: 'DECAY', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'fb', label: 'FEEDBK', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'detune', label: 'DETUNE', min: 0, max: 1, def: 0, unit: '%' },
  { id: 'att', label: 'ATTACK', min: 0, max: 1, def: 0, unit: '%' },
  { id: 'rel', label: 'RELEASE', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'velo', label: 'VEL SENS', min: 0, max: 1, def: 0.5, unit: '%' },
]
const fmIn: ModuleSpec['inputs'] = [
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'vel', label: 'VEL' },
  { id: 'bright', label: 'BRIGHT' },
]
const fmOut: ModuleSpec['outputs'] = [
  { id: 'out', label: 'OUT' },
  { id: 'poly', label: 'POLY', poly: true },
]
const FM_HP = 16
const FM_W = FM_HP * HP_MM
const fmLayout = packRows(
  [
    ['voice', 'algo', 'tune', 'level'].map(knob),
    ['bright', 'decay', 'fb', 'detune'].map(knob),
    [knob('att'), knob('rel'), knob('velo'), null],
    fmIn.map((j) => jack('in', j.id)),
    [null, null, jack('out', 'out'), jack('out', 'poly')],
  ],
  { params: fmParams, inputs: fmIn, outputs: fmOut },
  FM_W,
  { grid: true, gap: 2.6 },
)
/** LEDs: each operator's envelope on the newest note, then each voice's level. */
export const FML = { ops: 0, voices: 4 } as const
/** The screen above the knobs: the sound, its wiring, the notes sounding. */
const SCREEN_Y = 16
const screen = (top: number, w: number, name: string): Control => ({ kind: 'surface', name, x: 6, y: SCREEN_Y, w: w - 12, h: top - SCREEN_Y - 4 })

/** A four-operator FM voice, up to eight notes at once. VOICE picks a
 *  factory sound (its operators' ratios, levels and envelopes, and an
 *  algorithm); the knobs reshape it: BRIGHT scales every modulator (the
 *  filter-like knob of FM), DECAY stretches all the envelopes, FEEDBK is
 *  operator 4 feeding itself, ALGO swaps the wiring. Plays from the keys when
 *  GATE is empty; patch POLY·CV's V/OCT, GATE and VEL to play it from cables. */
export const fm4: ModuleSpec = {
  type: 'fm4',
  title: 'FM-4',
  name: 'FM-4 Operator Voice',
  tagline: 'Four-operator FM, 8 notes: electric piano, bass, bells, brass, organ; BRIGHT, DECAY, FEEDBK, eight algorithms',
  category: 'Polyphonic',
  hp: FM_HP,
  panel: SAND,
  inputs: fmIn,
  outputs: fmOut,
  params: fmParams,
  leds: 12,
  controls: [screen(fmLayout.top, FM_W, 'fm4'), ...fmLayout.controls],
}

// ---- SWARM ----
const swParams: ParamSpec[] = [
  { id: 'tune', label: 'TUNE', min: -24, max: 24, def: 0, stepped: true, unit: 'st' },
  { id: 'detune', label: 'DETUNE', min: 0, max: 1, def: 0.45, unit: '%' },
  { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.65, unit: '%' },
  { id: 'spread', label: 'SPREAD', min: 0, max: 1, def: 0.7, unit: '%' },
  { id: 'sub', label: 'SUB', min: 0, max: 1, def: 0, unit: '%' },
  { id: 'cutoff', label: 'CUTOFF', min: 60, max: 16000, def: 9000, curve: 'exp', unit: 'Hz' },
  { id: 'res', label: 'RESONANCE', min: 0, max: 1, def: 0.15, unit: '%' },
  { id: 'cvamt', label: 'CV AMT', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'att', label: 'ATTACK', min: 0.001, max: 4, def: 0.005, curve: 'exp', unit: 's' },
  { id: 'rel', label: 'RELEASE', min: 0.01, max: 6, def: 0.4, curve: 'exp', unit: 's' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
]
const swIn: ModuleSpec['inputs'] = [
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'cut', label: 'CUTOFF' },
  { id: 'det', label: 'DETUNE' },
]
const swOut: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
  { id: 'poly', label: 'POLY', poly: true },
]
/** Where the six side saws sit around the centre one (at full detune): the
 *  measured spacing of the original supersaw, slightly uneven on purpose. */
export const SWARM_OFFSETS = [-0.11002313, -0.06288439, -0.01952356, 0, 0.01991221, 0.06216538, 0.10745242]
const DETUNE_LAW = [10028.7312891634, -50818.8652045924, 111363.4808729368, -138150.6761080548, 106649.6679158292, -53046.9642751875, 17019.951858008, -3425.0836591318, 404.2703938388, -24.1878824391, 0.6717417634, 0.0030115596]
/** The original's detune knob law: barely moves for the first half, then
 *  opens fast (a fitted polynomial, Horner form). */
export function swarmDetune(x: number): number {
  let y = 0
  for (let i = 0; i < DETUNE_LAW.length; i++) y = y * x + DETUNE_LAW[i]
  return y
}
/** The centre saw's and the side saws' levels for MIX. */
export const swarmMix = (m: number): [number, number] => [-0.55366 * m + 0.99785, -0.73764 * m * m + 1.2841 * m + 0.044372]

const SW_HP = 16
const SW_W = SW_HP * HP_MM
const swLayout = packRows(
  [
    ['tune', 'detune', 'mix', 'spread'].map(knob),
    ['sub', 'cutoff', 'res', 'cvamt'].map(knob),
    [knob('att'), knob('rel'), knob('level'), null],
    swIn.map((j) => jack('in', j.id)),
    [null, jack('out', 'l'), jack('out', 'r'), jack('out', 'poly')],
  ],
  { params: swParams, inputs: swIn, outputs: swOut },
  SW_W,
  { grid: true, gap: 2.6 },
)

/** Seven detuned saws per note, the trance supersaw: DETUNE pulls them apart
 *  (gently at first, then fast, as on the original), MIX balances the centre
 *  saw against the six around it, SPREAD fans them across the stereo field.
 *  A sub an octave down, a 12 dB filter and an envelope per note. Up to eight
 *  notes: plays from the keys when GATE is empty, from POLY·CV's cables when
 *  it isn't; V/OCT alone (no GATE) makes it a drone oscillator. */
export const swarm: ModuleSpec = {
  type: 'swarm',
  title: 'SWARM',
  name: 'Supersaw Voice',
  tagline: 'Seven detuned saws per note, stereo spread, sub, filter and envelope; 8 notes: trance leads, EDM chords, huge pads',
  category: 'Polyphonic',
  hp: SW_HP,
  panel: SAGE,
  inputs: swIn,
  outputs: swOut,
  params: swParams,
  leds: 8,
  controls: [screen(swLayout.top, SW_W, 'swarm'), ...swLayout.controls],
}
