import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLUE, GRAPHITE, SLATE } from './panels'

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'M' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

// ---- GRAINS ----
export const GRAIN_SECONDS = 4
export const MAX_GRAINS = 32
export const WAVE_BINS = 64
/** LEDs: the buffer's waveform (peak per bin), each grain's place in the
 *  buffer (0..1 of its length; −1 = idle) and level, and the write head
 *  (0..1), so the screen can draw "now" at the right. */
export const GRL = { wave: 0, pos: WAVE_BINS, amp: WAVE_BINS + MAX_GRAINS, head: WAVE_BINS + MAX_GRAINS * 2, end: WAVE_BINS + MAX_GRAINS * 2 + 1 } as const

const grParams: ParamSpec[] = [
  { id: 'pos', label: 'POSITION', min: 0, max: 1, def: 0.25, unit: '%' },
  { id: 'size', label: 'SIZE', min: 0.01, max: 1, def: 0.15, curve: 'exp', unit: 's' },
  { id: 'density', label: 'DENSITY', min: 0.5, max: 80, def: 14, curve: 'exp', unit: 'Hz' },
  { id: 'pitch', label: 'PITCH', min: -24, max: 24, def: 0, stepped: true, unit: 'st' },
  { id: 'spray', label: 'SPRAY', min: 0, max: 1, def: 0.2, unit: '%' },
  { id: 'spread', label: 'SPREAD', min: 0, max: 1, def: 0.6, unit: '%' },
  { id: 'rev', label: 'REVERSE', min: 0, max: 1, def: 0, unit: '%' },
  { id: 'fb', label: 'FEEDBACK', min: 0, max: 0.9, def: 0.15, unit: '%' },
  { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.6, unit: '%' },
  { id: 'freeze', label: 'FREEZE', min: 0, max: 1, def: 0, stepped: true, options: ['LIVE', 'FREEZE'] },
]
const grIn: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'frz', label: 'FREEZE' },
  { id: 'pos', label: 'POSITION' },
  { id: 'voct', label: 'V/OCT' },
  { id: 'trig', label: 'TRIG' },
  { id: 'dens', label: 'DENSITY' },
]
const stereo: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]
const GR_HP = 20
const GR_W = GR_HP * HP_MM
const grLayout = packRows(
  [
    ['pos', 'size', 'density', 'pitch'].map(knob),
    ['spray', 'spread', 'rev', 'fb'].map(knob),
    [knob('mix'), sw('freeze'), null, null],
    ['in', 'frz', 'pos', 'voct'].map((j) => jack('in', j)),
    [jack('in', 'trig'), jack('in', 'dens'), jack('out', 'l'), jack('out', 'r')],
  ],
  { params: grParams, inputs: grIn, outputs: stereo },
  GR_W,
  { grid: true, gap: 3 },
)

/** A granular cloud (Clouds / Morphagene tradition). The input runs through
 *  a four-second memory; grains (short faded slices of it) are played from
 *  POSITION (how far back), SIZE long, DENSITY times a second, each at PITCH
 *  and somewhere across the stereo field (SPREAD), with SPRAY scattering
 *  where they start and REVERSE the chance one plays backwards. FREEZE stops
 *  recording, so you play with what's in there; FEEDBACK writes the cloud
 *  back into the memory for washes. TRIG fires a grain on demand. */
export const grains: ModuleSpec = {
  type: 'grains',
  title: 'GRAINS',
  name: 'Granular Cloud',
  tagline: 'Granular memory: clouds of tiny slices of the last 4 s, pitched, sprayed and spread; FREEZE to hold a moment',
  category: 'Effects',
  hp: GR_HP,
  panel: SLATE,
  inputs: grIn,
  outputs: stereo,
  params: grParams,
  leds: GRL.end,
  controls: [{ kind: 'surface', name: 'grains', x: 5, y: 16, w: GR_W - 10, h: grLayout.top - 16 - 3 }, ...grLayout.controls],
}

// ---- SHIMMER ----
export const SHIMMER_INTERVALS = ['+12', '+7', '+19', '+24', '−12']
export const SHIMMER_SEMIS = [12, 7, 19, 24, -12]
const shParams: ParamSpec[] = [
  { id: 'decay', label: 'DECAY', min: 0, max: 0.97, def: 0.85, unit: '%' },
  { id: 'shimmer', label: 'SHIMMER', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'interval', label: 'INTERVAL', min: 0, max: SHIMMER_INTERVALS.length - 1, def: 0, stepped: true, options: SHIMMER_INTERVALS },
  { id: 'damp', label: 'DAMPING', min: 0, max: 1, def: 0.35, unit: '%' },
  { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.45, unit: '%' },
  { id: 'freeze', label: 'FREEZE', min: 0, max: 1, def: 0, stepped: true, options: ['LIVE', 'FREEZE'] },
]
const shIn: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'shm', label: 'SHIMMER' },
  { id: 'frz', label: 'FREEZE' },
]
const SH_HP = 12
const shLayout = packRows(
  [
    [knob('decay'), knob('shimmer'), knob('interval')],
    [knob('damp'), knob('mix'), sw('freeze')],
    [jack('in', 'in'), jack('in', 'shm'), jack('in', 'frz')],
    [jack('out', 'l'), jack('out', 'r'), null],
  ],
  { params: shParams, inputs: shIn, outputs: stereo },
  SH_HP * HP_MM,
  { grid: true, gap: 3.5 },
)

/** A shimmer reverb: the plate, with a copy of its tail pitch-shifted (an
 *  octave up by default) and fed back in, so every repeat of the tail climbs:
 *  the glowing, choir-like wash of ambient guitar. SHIMMER sets how much
 *  climbs; FREEZE holds the tail forever and stops new sound coming in. */
export const shimmer: ModuleSpec = {
  type: 'shimmer',
  title: 'SHIMMER',
  name: 'Shimmer Reverb',
  tagline: 'A reverb whose tail climbs in octaves (or fifths) as it rings: the glowing ambient wash; FREEZE holds it',
  category: 'Effects',
  hp: SH_HP,
  panel: BLUE,
  inputs: shIn,
  outputs: stereo,
  params: shParams,
  controls: shLayout.controls,
}

// ---- SHIFT ----
const sfParams: ParamSpec[] = [
  { id: 'a', label: 'SHIFT A', min: -24, max: 24, def: 12, stepped: true, unit: 'st' },
  { id: 'b', label: 'SHIFT B', min: -24, max: 24, def: 7, stepped: true, unit: 'st' },
  { id: 'fine', label: 'FINE', min: -0.5, max: 0.5, def: 0, unit: 'st' },
  { id: 'la', label: 'LEVEL A', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'lb', label: 'LEVEL B', min: 0, max: 1, def: 0, unit: '%' },
  { id: 'size', label: 'SIZE', min: 0.015, max: 0.2, def: 0.06, curve: 'exp', unit: 's' },
  { id: 'fb', label: 'FEEDBACK', min: 0, max: 0.9, def: 0, unit: '%' },
  { id: 'delay', label: 'DELAY', min: 0.01, max: 1, def: 0.25, curve: 'exp', unit: 's' },
  { id: 'mix', label: 'MIX', min: 0, max: 1, def: 0.5, unit: '%' },
]
const sfIn: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'cva', label: 'SHIFT A' },
  { id: 'cvb', label: 'SHIFT B' },
]
const SF_HP = 14
const sfLayout = packRows(
  [
    ['a', 'b', 'fine'].map(knob),
    ['la', 'lb', 'size'].map(knob),
    ['fb', 'delay', 'mix'].map(knob),
    sfIn.map((j) => jack('in', j.id)),
    [jack('out', 'l'), jack('out', 'r'), null],
  ],
  { params: sfParams, inputs: sfIn, outputs: stereo },
  SF_HP * HP_MM,
  { grid: true, gap: 2.6 },
)

/** A two-voice pitch shifter (the harmoniser). Each voice plays the input
 *  SHIFT semitones away (A an octave up, B a fifth, by default; CV inputs add
 *  1 V/oct, so a sequencer can play the harmony). FINE detunes both for a
 *  thick doubling; SIZE trades smoothness for tightness. FEEDBACK sends the
 *  shifted sound back through, DELAY later, so each repeat climbs again: the
 *  pitch spiral. A sits left, B right. */
export const shift: ModuleSpec = {
  type: 'shift',
  title: 'SHIFT',
  name: 'Pitch Shifter',
  tagline: 'Two-voice harmoniser: octaves, fifths, detuned doubling, and a feedback spiral that climbs forever',
  category: 'Effects',
  hp: SF_HP,
  panel: GRAPHITE,
  inputs: sfIn,
  outputs: stereo,
  params: sfParams,
  controls: sfLayout.controls,
}
