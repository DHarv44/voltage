import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLACK } from './panels'

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'len', label: 'LENGTH', min: 0.5, max: 16, def: 4, curve: 'exp', unit: 's' },
  { id: 'noise', label: 'NOISE', min: 0, max: 1, def: 0.7, unit: '%' },
  { id: 'tone', label: 'TONE', min: 0, max: 1, def: 0.4, unit: '%' },
  { id: 'bright', label: 'BRIGHT', min: 0, max: 1, def: 0.6, unit: '%' },
  { id: 'impact', label: 'IMPACT', min: 0, max: 1, def: 0.6, unit: '%' },
  { id: 'down', label: 'DOWN', min: 0, max: 1, def: 0.4, unit: '%' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.7, unit: '%' },
  { id: 'roll', label: 'ROLL', min: 0, max: 1, def: 1, stepped: true, options: ['OFF', 'ROLL'] },
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'gate', label: 'GATE' },
  { id: 'ramp', label: 'RAMP' },
  { id: 'clk', label: 'CLK' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'sweep', label: 'SWEEP' },
  { id: 'rollo', label: 'ROLL' },
  { id: 'hit', label: 'HIT' },
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]
const HP = 16
const W = HP * HP_MM
const layout = packRows(
  [
    [knob('len'), knob('noise'), knob('tone'), knob('bright')],
    [knob('impact'), knob('down'), knob('level'), { kind: 'switch', param: 'roll', x: 0, y: 0 }],
    [jack('in', 'gate'), jack('in', 'ramp'), jack('in', 'clk'), null],
    [jack('out', 'sweep'), jack('out', 'rollo'), jack('out', 'hit'), null],
    [null, jack('out', 'l'), jack('out', 'r'), null],
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 1.4 },
)

/** RISER: the build into a drop, and the drop's landing. While it rises (a
 *  GATE held for LENGTH, or following a RAMP such as ARRANGER XL's) noise
 *  sweeps up through a tightening filter, a detuned tone climbs two octaves
 *  and spreads wide, ROLL fires an accelerating snare roll (on CLK's 16ths
 *  if patched) and SWEEP climbs 0–10 V to open filters. When it ends: an
 *  IMPACT (a sub boom and a burst), a DOWN sweep falling away, and a HIT. */
export const riser: ModuleSpec = {
  type: 'riser',
  title: 'RISER',
  name: 'Riser & Impact',
  tagline: 'Build-ups for drops: rising noise and tone, an accelerating snare roll, a filter-sweep CV; then an impact and a downlifter. Follows a gate or ARRANGER XL’s RAMP',
  category: 'Effects',
  hp: HP,
  panel: BLACK,
  inputs,
  outputs,
  params,
  leds: 1,
  controls: layout.controls,
}
