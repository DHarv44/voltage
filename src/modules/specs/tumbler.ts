import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec } from '../types'
import { SAND } from './panels'
import { QUANT_SCALES } from './shapers'

export const TUMBLER_BALLS = 4
export const TUMBLER_MAX_SIDES = 8
/** LED layout: the drum's angle (turns, 0..1), x,y per ball (0..1, −1 = not
 *  in play), then a flash per wall. */
export const TUMBLERL = { angle: 0, pos: 1, flash: 1 + TUMBLER_BALLS * 2 } as const

const HP = 16
const W = HP * HP_MM

const params: ModuleSpec['params'] = [
  { id: 'sides', label: 'SIDES', min: 3, max: TUMBLER_MAX_SIDES, def: 5, stepped: true },
  { id: 'speed', label: 'SPIN', min: -1, max: 1, def: 0.12, unit: 'Hz' },
  { id: 'gravity', label: 'GRAVITY', min: 0.2, max: 3, def: 1, curve: 'exp', unit: 'x' },
  { id: 'bounce', label: 'BOUNCE', min: 0.3, max: 0.98, def: 0.75, unit: '%' },
  { id: 'balls', label: 'BALLS', min: 1, max: TUMBLER_BALLS, def: 2, stepped: true },
  { id: 'scale', label: 'SCALE', min: 0, max: QUANT_SCALES.length - 1, def: 4, stepped: true, options: QUANT_SCALES },
  { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
  { id: 'len', label: 'GATE', min: 0.02, max: 1, def: 0.15, curve: 'exp', unit: 's' },
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'kick', label: 'KICK' },
  { id: 'spin', label: 'SPIN' },
  { id: 'grav', label: 'GRAV' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'pitch', label: 'PITCH' },
  { id: 'gate', label: 'GATE' },
  { id: 'trig', label: 'TRIG' },
  { id: 'vel', label: 'VEL' },
]

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const { controls, top } = packRows(
  [
    ['sides', 'speed', 'gravity', 'bounce'].map(knob),
    ['balls', 'scale', 'oct', 'len'].map(knob),
    [jack('in', 'kick'), jack('in', 'spin'), jack('in', 'grav'), null],
    ['pitch', 'gate', 'trig', 'vel'].map((j) => jack('out', j)),
  ],
  { params, inputs, outputs },
  W,
  { grid: true },
)
const DRUM_TOP = 15

/** A spinning drum with balls in it. The drum (3–8 sided) turns at SPIN;
 *  the balls fall, ride up the walls and tumble down as they steepen, and
 *  every wall they hit plays that wall's note (wall k = scale degree k, so a
 *  pentagon in PENTA plays the whole scale). The walls move, so a fast drum
 *  flings the balls; friction carries them up. KICK throws them; drag the
 *  drum round to spin it by hand, click to kick. */
export const tumbler: ModuleSpec = {
  type: 'tumbler',
  title: 'TUMBLER',
  name: 'Tumbler',
  tagline: 'Balls in a spinning drum: every wall they hit plays its note; spin it, tilt gravity, kick it',
  category: 'Simulations',
  hp: HP,
  panel: SAND,
  inputs,
  outputs,
  params,
  leds: 1 + TUMBLER_BALLS * 2 + TUMBLER_MAX_SIDES,
  controls: [{ kind: 'surface', name: 'tumbler', x: 4, y: DRUM_TOP, w: W - 8, h: top - 1.6 - DRUM_TOP }, ...controls],
}
