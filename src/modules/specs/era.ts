import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { ERA_NAMES } from './sampling'
import { CREAM } from './panels'

const knob = (param: string, size: 'S' | 'M' = 'M'): Control => ({ kind: 'knob', param, x: 0, y: 0, size })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'era', label: 'ERA', min: 0, max: ERA_NAMES.length - 1, def: 3, stepped: true, options: ERA_NAMES },
  { id: 'rate', label: 'RATE ×', min: 0.25, max: 2, def: 1, curve: 'exp', unit: 'x' },
  { id: 'bits', label: 'BITS ±', min: -6, max: 4, def: 0, stepped: true },
  { id: 'mix', label: 'MIX', min: 0, max: 1, def: 1, unit: '%' },
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'rcv', label: 'RATE CV' },
]
const outputs: ModuleSpec['outputs'] = [{ id: 'out', label: 'OUT' }]
const HP = 12
const layout = packRows(
  [[knob('era')], [knob('rate'), knob('bits')], [knob('mix', 'S')], [jack('in', 'in'), jack('in', 'rcv')], [jack('out', 'out')]],
  { params, inputs, outputs },
  HP * HP_MM,
  { gap: 1.6 },
)

/** ERA: run any cable through a period sampler's converters. Each era is a
 *  generation of hardware: its bits (companded or straight), its sample rate,
 *  and its filters or the lack of them (no anti-alias filter: the highs fold
 *  back down as grit; no reconstruction filter: the steps ring metallic).
 *  RATE × and BITS ± push it further; RATE CV (1 V/oct) sweeps the rate. */
export const era: ModuleSpec = {
  type: 'era',
  title: 'ERA',
  name: 'Sampler Converter',
  tagline: 'Any sound through a period sampler’s converters: early 8-bit, companded, 12-bit punch, home computer, 90s rack; rate and bits to push it',
  category: 'Effects',
  hp: HP,
  panel: CREAM,
  inputs,
  outputs,
  params,
  controls: layout.controls,
}
