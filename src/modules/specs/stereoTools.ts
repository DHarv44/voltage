import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { ALU, BLACK } from './panels'

const knob = (param: string, size: 'S' | 'M' = 'S'): Control => ({ kind: 'knob', param, x: 0, y: 0, size })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const led = (index: number, bipolar = false): Control => ({ kind: 'led', index, x: 0, y: 0, bipolar })

/** Rows packed from the bottom of an `hp`-wide panel, spaced out a little. */
export const rows = (hp: number, r: (Control | null)[][], spec: Pick<ModuleSpec, 'params' | 'inputs' | 'outputs'>, gap = 4): Control[] =>
  packRows(r, spec, hp * HP_MM, { gap }).controls

export const PAN_SHAPES = ['SINE', 'TRI', 'SQUARE', 'RANDOM']

const panParams: ParamSpec[] = [
  { id: 'pan', label: 'PAN', min: -1, max: 1, def: 0, unit: '%' },
  { id: 'auto', label: 'AUTO', min: 0, max: 1, def: 0, unit: '%' },
  { id: 'rate', label: 'RATE', min: 0.05, max: 12, def: 0.5, curve: 'exp', unit: 'Hz' },
  { id: 'shape', label: 'SHAPE', min: 0, max: PAN_SHAPES.length - 1, def: 0, stepped: true, options: PAN_SHAPES },
]
const panIn: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'cv', label: 'PAN CV' },
  { id: 'rst', label: 'RST' },
]
const panOut: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]

/** A mono sound placed between the speakers (equal-power, so it doesn't dip
 *  in the middle), and moved by its own auto-pan LFO or by CV. */
export const panner: ModuleSpec = {
  type: 'panner',
  title: 'PANNER',
  name: 'Panner',
  tagline: 'Places a mono sound between the speakers; built-in auto-pan (sine, triangle, hard square, random); pan CV',
  category: 'Amps & Mixers',
  hp: 8,
  panel: ALU,
  inputs: panIn,
  outputs: panOut,
  params: panParams,
  leds: 2,
  controls: rows(8, [[knob('pan', 'M')], [knob('auto'), knob('rate')], [knob('shape'), led(0), led(1)], [jack('in', 'in'), jack('in', 'cv'), jack('in', 'rst')], [jack('out', 'l'), jack('out', 'r')]], {
    params: panParams,
    inputs: panIn,
    outputs: panOut,
  }),
}

const wideParams: ParamSpec[] = [
  { id: 'width', label: 'WIDTH', min: 0, max: 2, def: 1.4, unit: '%' },
  { id: 'haas', label: 'HAAS', min: 0, max: 0.025, def: 0.009, unit: 's' },
  { id: 'mono', label: 'BASS MONO', min: 20, max: 400, def: 120, curve: 'exp', unit: 'Hz' },
]
const wideIn: ModuleSpec['inputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
  { id: 'cv', label: 'WIDTH CV' },
]
const wideOut: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]

/** Mid/side widener: WIDTH scales the difference between the channels (0 is
 *  mono, 1 untouched, 2 twice as wide). A mono sound (R unpatched) is split
 *  first by delaying one side a few ms (the Haas effect). BASS MONO keeps the
 *  lows centred so the mix stays solid on a club system. The light shows the
 *  correlation: green in phase, red if the channels fight (it'd vanish in mono). */
export const widener: ModuleSpec = {
  type: 'widener',
  title: 'WIDENER',
  name: 'Stereo Widener',
  tagline: 'Mid/side width (mono to twice as wide), Haas widening for mono sounds, bass kept mono, a phase-correlation light',
  category: 'Amps & Mixers',
  hp: 8,
  panel: BLACK,
  inputs: wideIn,
  outputs: wideOut,
  params: wideParams,
  leds: 1,
  controls: rows(8, [[knob('width', 'M')], [knob('haas'), knob('mono')], [led(0, true)], [jack('in', 'l'), jack('in', 'r'), jack('in', 'cv')], [jack('out', 'l'), jack('out', 'r')]], {
    params: wideParams,
    inputs: wideIn,
    outputs: wideOut,
  }),
}
