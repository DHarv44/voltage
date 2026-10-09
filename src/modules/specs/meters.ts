import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLACK } from './panels'

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

/** A screen over everything above the packed rows. */
function withScreen(hp: number, name: string, r: (Control | null)[][], spec: Pick<ModuleSpec, 'params' | 'inputs' | 'outputs'>): Control[] {
  const w = hp * HP_MM
  const { controls, top } = packRows(r, spec, w, { gap: 1.6 })
  return [{ kind: 'surface', name, x: 4, y: 14, w: w - 8, h: top - BEZEL - 1.5 - 14 }, ...controls]
}

// ---- TUNER ----

/** LEDs: the nearest note (MIDI number), cents off it, voiced, the frequency (Hz), level. */
export const TUNERL = { note: 0, cents: 1, voiced: 2, hz: 3, level: 4 } as const

const tParams: ParamSpec[] = [{ id: 'ref', label: 'A4', min: 415, max: 466, def: 440, unit: 'Hz' }]
const tIn: ModuleSpec['inputs'] = [{ id: 'in', label: 'IN' }]
const tOut: ModuleSpec['outputs'] = [
  { id: 'pitch', label: 'PITCH' },
  { id: 'gate', label: 'GATE' },
]

/** A tuner: the note and how far off it is, on a needle and a strobe (the
 *  strobe drifts the way the note is off, and stands still when it's in tune).
 *  Also a pitch follower: PITCH (V/OCT) and GATE out. */
export const tuner: ModuleSpec = {
  type: 'tuner',
  title: 'TUNER',
  name: 'Tuner',
  tagline: 'The note and how many cents off, on a needle and a strobe; A4 from 415 to 466 Hz; PITCH and GATE out (pitch to CV)',
  category: 'Visuals',
  hp: 10,
  panel: BLACK,
  inputs: tIn,
  outputs: tOut,
  params: tParams,
  leds: 5,
  controls: withScreen(10, 'tunerscreen', [[knob('ref'), jack('in', 'in')], [jack('out', 'pitch'), jack('out', 'gate')]], { params: tParams, inputs: tIn, outputs: tOut }),
}

// ---- ANALYSER ----

/** LEDs: loudness momentary / short-term / integrated (LUFS; −99 none yet),
 *  peak L / R and the highest since reset (dBFS, 5 V = 0 dB), correlation. */
export const ANAL = { m: 0, s: 1, i: 2, pl: 3, pr: 4, max: 5, corr: 6 } as const

const aParams: ParamSpec[] = [
  { id: 'range', label: 'RANGE', min: 40, max: 100, def: 70, unit: 'dB' },
  { id: 'tilt', label: 'TILT', min: 0, max: 6, def: 3, unit: 'dB' },
  { id: 'target', label: 'TARGET', min: -24, max: -6, def: -14, unit: 'dB' },
]
const aIn: ModuleSpec['inputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
  { id: 'rst', label: 'RST' },
]
const aOut: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]

/** An analyser for the mix: spectrum (log frequency, with a peak-hold line),
 *  loudness in LUFS (momentary, short-term, integrated; the way streaming
 *  services measure it), peaks and a phase-correlation meter. It passes the
 *  sound through, so it can sit before OUT. Click the screen (or RST) to
 *  start the integrated reading again. */
export const analyser: ModuleSpec = {
  type: 'analyser',
  title: 'ANALYSER',
  name: 'Analyser',
  tagline: 'Spectrum with peak hold, loudness in LUFS (momentary, short-term, integrated), peaks and a correlation meter; passes the sound through',
  category: 'Visuals',
  hp: 24,
  panel: BLACK,
  inputs: aIn,
  outputs: aOut,
  params: aParams,
  leds: 7,
  controls: withScreen(24, 'analyser', [[knob('range'), knob('tilt'), knob('target'), jack('in', 'l'), jack('in', 'r'), jack('in', 'rst'), jack('out', 'l'), jack('out', 'r')]], {
    params: aParams,
    inputs: aIn,
    outputs: aOut,
  }),
}
