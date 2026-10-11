import { BEZEL, packRows } from '../../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../../types'
import { AMP } from '../panels'
import { COMBO_INPUTS, partButtons } from './core'
import { CL, COMBO_LEDS, COMBO_PARTS, comboParams } from './params'

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'M' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jin = (jack: string): Control => ({ kind: 'in', jack, x: 0, y: 0 })
const jout = (jack: string): Control => ({ kind: 'out', jack, x: 0, y: 0 })
const button = (name: string, label: string, led?: number): Control => ({ kind: 'button', name, x: 0, y: 0, label, led, ledColor: '#ff4a3a' })
/** A row centred in `n` columns (so every row shares one grid). */
const centre = (row: (Control | null)[], n: number): (Control | null)[] => {
  const pad = n - row.length
  return [...Array(Math.floor(pad / 2)).fill(null), ...row, ...Array(Math.ceil(pad / 2)).fill(null)]
}

/** The mix, the looper's tempo switch, and each part loop's recorded tempo. */
const MIX: ParamSpec[] = [
  { id: 'drums', label: 'DRUMS', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'bassl', label: 'BASS', min: 0, max: 1, def: 0.75, unit: '%' },
  { id: 'loopl', label: 'LOOP', min: 0, max: 1.5, def: 1, unit: '%' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'stretch', label: 'LOOP TEMPO', min: 0, max: 1, def: 1, stepped: true, options: ['TAPE', 'STRETCH'] },
  ...Array.from({ length: COMBO_PARTS }, (_, i): ParamSpec => ({ id: `lt${i}`, label: `LOOP ${i + 1} TEMPO`, min: 0, max: 300, def: 0 })),
]
const PARAMS = [...comboParams(), ...MIX]
const INPUTS: ModuleSpec['inputs'] = [...COMBO_INPUTS, { id: 'loop', label: 'LOOP' }]
const OUTPUTS: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
  { id: 'bandout', label: 'BAND' },
  { id: 'kick', label: 'KICK' },
  { id: 'snare', label: 'SNARE' },
  { id: 'bass', label: 'BASS' },
  { id: 'bgate', label: 'B.GATE' },
  { id: 'chord', label: 'CHORD', poly: true },
  { id: 'clko', label: 'CLK' },
  { id: 'rsto', label: 'RST' },
  { id: 'link', label: 'LINK' },
]

const W = 30 * HP_MM
const COLS = 11
const layout = packRows(
  [
    centre(['genre', 'style', 'tempo', 'drums', 'bassl', 'loopl', 'level'].map(knob), COLS),
    centre([sw('alt'), sw('sbass'), sw('count'), sw('stretch'), button('undo', 'UNDO'), button('clear', 'CLEAR')], COLS),
    centre([...partButtons(), button('loop', 'LOOPER', CL.loopLed)], COLS),
    centre(INPUTS.map((j) => jin(j.id)), COLS),
    OUTPUTS.map((j) => jout(j.id)),
  ],
  { params: PARAMS, inputs: INPUTS, outputs: OUTPUTS },
  W,
  { gap: 1.4, grid: true },
)

/** A band in a box with a looper: teach it a part by playing it (into IN,
 *  or as notes on V/OCT + GATE) and its own drummer and bass player play
 *  along in 12 genres × 12 styles; loop yourself over each part. Your
 *  playing passes through to L / R with the band and the loops. */
export const combo: ModuleSpec = {
  type: 'combo',
  title: 'COMBO',
  name: 'Combo (Band + Looper)',
  tagline: 'Teach it a part by playing it: its drummer and bass player play along in 12 genres × 12 styles; 5 parts with fills; a looper per part (STRETCH or TAPE when the tempo moves)',
  category: 'Brains',
  hp: 30,
  panel: AMP,
  inputs: INPUTS,
  outputs: OUTPUTS,
  params: PARAMS,
  leds: COMBO_LEDS,
  controls: [{ kind: 'surface', name: 'comboscreen', x: 4, y: 12, w: W - 8, h: layout.top - BEZEL - 3 - 12 }, ...layout.controls],
}
