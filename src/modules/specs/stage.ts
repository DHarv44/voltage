import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { RED } from './panels'

/** STAGE's two instruments: a hammer on a tine (with its tonebar) over a
 *  magnetic pickup, or a hammer on a steel reed that's one plate of a
 *  capacitor. */
export const STAGE_MODELS = ['TINE', 'REED']

const params: ParamSpec[] = [
  { id: 'model', label: 'MODEL', min: 0, max: STAGE_MODELS.length - 1, def: 0, stepped: true, options: STAGE_MODELS },
  { id: 'voicing', label: 'VOICING', min: 0, max: 1, def: 0.45, unit: '%' },
  { id: 'bell', label: 'BELL', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'decay', label: 'DECAY', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'drive', label: 'DRIVE', min: 0, max: 1, def: 0.25, unit: '%' },
  { id: 'trem', label: 'TREM', min: 0, max: 1, def: 0.35, unit: '%' },
  { id: 'rate', label: 'RATE', min: 0.5, max: 10, def: 4.5, curve: 'exp', unit: 'Hz' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'vel', label: 'VEL' },
  { id: 'sus', label: 'SUS' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]
const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'M' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const W = 16 * HP_MM
const layout = packRows(
  [
    ['model', 'voicing', 'bell', 'decay'].map(knob),
    ['drive', 'trem', 'rate', 'level'].map(knob),
    inputs.map((j) => jack('in', j.id)),
    [null, null, jack('out', 'l'), jack('out', 'r')],
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 9 },
)

/** A stage electric piano, physically modelled, eight notes. TINE: a felt
 *  hammer strikes a tine whose tonebar keeps it ringing; the magnetic pickup
 *  sees it swing past, near-linear for soft notes (round, bell-like) and
 *  bending hard for loud ones (the bark). VOICING is how far the tine sits
 *  off the pickup's centre; the stereo tremolo pans it speaker to speaker.
 *  REED: a steel reed in an electrostatic pickup, nasal and biting when you
 *  dig in, with a mono amplitude tremolo. Plays from the keys when GATE is
 *  empty; a sustain pedal (SUS, or MIDI) holds the notes. */
export const stage: ModuleSpec = {
  type: 'stage',
  title: 'STAGE',
  name: 'Stage Electric Piano',
  tagline: 'Modelled electric piano, 8 notes: a tine over a magnetic pickup (bell to bark) or a reed (nasal bite); velocity, voicing, stereo or amplitude tremolo, sustain pedal',
  category: 'Polyphonic',
  hp: 16,
  panel: RED,
  inputs,
  outputs,
  params,
  leds: 8,
  controls: [...layout.controls, ...Array.from({ length: 8 }, (_, v): Control => ({ kind: 'led', index: v, x: W / 2 + (v - 3.5) * 6, y: layout.top - 7, color: '#ffb347' }))],
}
