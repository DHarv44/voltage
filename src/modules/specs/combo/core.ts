import { BEZEL, packRows } from '../../panelMetrics'
import { HP_MM, type Control, type ModuleSpec } from '../../types'
import { GRAPHITE } from '../panels'
import { CL, COMBO_LEDS, COMBO_PARTS, comboParams } from './params'

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'M' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jin = (jack: string): Control => ({ kind: 'in', jack, x: 0, y: 0 })
const jout = (jack: string): Control => ({ kind: 'out', jack, x: 0, y: 0 })
/** BAND, and a button per part (lit: learned; bright: high intensity). */
export const partButtons = (): Control[] => [
  { kind: 'button', name: 'band', x: 0, y: 0, label: 'BAND', led: CL.bandLed, ledColor: '#ff4a3a' },
  ...Array.from({ length: COMBO_PARTS }, (_, i): Control => ({ kind: 'button', name: `p${i}`, x: 0, y: 0, label: `PART ${i + 1}`, led: CL.parts + i, ledColor: '#5ef27a' })),
]

/** What COMBO and COMBO CORE take in: your playing (audio, or notes on poly
 *  cables), a clock to follow, and footswitch gates. */
export const COMBO_INPUTS: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
  { id: 'band', label: 'BAND' },
  { id: 'next', label: 'NEXT' },
  { id: 'part', label: 'PART' },
]
/** The band as voltages: a gate per drum, the bass line, the chords, the clock. */
export const CORE_OUTPUTS: ModuleSpec['outputs'] = [
  { id: 'kick', label: 'KICK' },
  { id: 'snare', label: 'SNARE' },
  { id: 'hat', label: 'HAT' },
  { id: 'ohat', label: 'OPEN' },
  { id: 'ride', label: 'RIDE' },
  { id: 'tom', label: 'TOM' },
  { id: 'perc', label: 'PERC' },
  { id: 'crash', label: 'CRASH' },
  { id: 'acc', label: 'ACC' },
  { id: 'bass', label: 'BASS' },
  { id: 'bgate', label: 'B.GATE' },
  { id: 'chord', label: 'CHORD', poly: true },
  { id: 'root', label: 'ROOT' },
  { id: 'clko', label: 'CLK' },
  { id: 'rsto', label: 'RST' },
  { id: 'link', label: 'LINK' },
]

const PARAMS = comboParams()
const W = 24 * HP_MM
const layout = packRows(
  [
    // eight columns down the panel; the six-wide rows centred in them
    [null, knob('genre'), knob('style'), knob('tempo'), sw('alt'), sw('sbass'), sw('count'), null],
    [null, ...partButtons(), null],
    COMBO_INPUTS.map((j) => jin(j.id)),
    CORE_OUTPUTS.slice(0, 8).map((j) => jout(j.id)),
    CORE_OUTPUTS.slice(8).map((j) => jout(j.id)),
  ],
  { params: PARAMS, inputs: COMBO_INPUTS, outputs: CORE_OUTPUTS },
  W,
  { gap: 1.4, grid: true },
)

/** COMBO's band brain with no sounds of its own: teach it a part (play it,
 *  on audio IN or as notes on V/OCT + GATE), and it plays drums and bass to
 *  it in a genre's style, as gates and voltages for any modules you like.
 *  Five parts, cued at the end of the one playing; LINK feeds the
 *  FOOTSWITCH and LOOPER. */
export const combocore: ModuleSpec = {
  type: 'combocore',
  title: 'COMBO CORE',
  name: 'Combo Core',
  tagline: 'The band brain: teach it a part by playing it, and it plays drums and bass to your chords in 12 genres × 12 styles, as gates and CV; 5 parts, fills, count-in',
  category: 'Brains',
  hp: 24,
  panel: GRAPHITE,
  inputs: COMBO_INPUTS,
  outputs: CORE_OUTPUTS,
  params: PARAMS,
  leds: COMBO_LEDS,
  controls: [{ kind: 'surface', name: 'comboscreen', x: 4, y: 12, w: W - 8, h: layout.top - BEZEL - 3 - 12 }, ...layout.controls],
}
