import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLACK, CREAM } from './panels'

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

// ---- VOCODER ----
export const VOC_BANDS = 16
/** Band centres: log-spaced from 100 Hz to 8 kHz. */
export const vocBand = (k: number) => 100 * Math.pow(80, k / (VOC_BANDS - 1))

const vocParams: ParamSpec[] = [
  { id: 'shift', label: 'SHIFT', min: -4, max: 4, def: 0, stepped: true },
  { id: 'q', label: 'Q', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'att', label: 'ATTACK', min: 0.001, max: 0.05, def: 0.004, curve: 'exp', unit: 's' },
  { id: 'rel', label: 'RELEASE', min: 0.01, max: 0.5, def: 0.06, curve: 'exp', unit: 's' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.7, unit: '%' },
  { id: 'sib', label: 'SIBILANCE', min: 0, max: 1, def: 0.3, unit: '%' },
  { id: 'noise', label: 'NOISE', min: 0, max: 1, def: 0.1, unit: '%' },
  { id: 'tune', label: 'TUNE', min: -2, max: 2, def: -1, unit: 'oct' },
  { id: 'mix', label: 'DRY', min: 0, max: 1, def: 0, unit: '%' },
  { id: 'freeze', label: 'FREEZE', min: 0, max: 1, def: 0, stepped: true, options: ['LIVE', 'HOLD'] },
]
const vocIn: ModuleSpec['inputs'] = [
  { id: 'mod', label: 'MOD' },
  { id: 'car', label: 'CARRIER' },
  { id: 'voct', label: 'V/OCT' },
  { id: 'frz', label: 'FREEZE' },
  { id: 'shift', label: 'SHIFT' },
]
const vocOut: ModuleSpec['outputs'] = [
  { id: 'out', label: 'OUT' },
  { id: 'env', label: 'ENV' },
]
const VOC_HP = 20
const VOC_W = VOC_HP * HP_MM
const big = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'M' })
const vocLayout = packRows(
  [
    ['shift', 'q', 'att', 'rel', 'level'].map(big),
    [...['sib', 'noise', 'tune', 'mix'].map(big), sw('freeze')],
    ['mod', 'car', 'voct', 'frz', 'shift'].map((j) => jack('in', j)),
    [jack('out', 'out'), jack('out', 'env'), null, null, null],
  ],
  { params: vocParams, inputs: vocIn, outputs: vocOut },
  VOC_W,
  { grid: true, gap: 3.5, maxPitch: 18 },
)
/** The band meter: one LED per band across the top, under the title. */
const METER_Y = 25
const meter: Control[] = Array.from({ length: VOC_BANDS }, (_, k) => ({
  kind: 'led',
  index: k,
  x: 8 + (k * (VOC_W - 16)) / (VOC_BANDS - 1),
  y: METER_Y,
  color: '#7fe3ff',
}))

/** A sixteen-band channel vocoder. MOD (a voice, a beat) is split into
 *  bands; each band's level opens the same band of CARRIER (a synth; if
 *  nothing is patched, a built-in buzz that follows V/OCT, with NOISE for the
 *  hiss of consonants). SHIFT moves the formants up or down by bands,
 *  SIBILANCE lets the modulator's top end through so S and T stay clear, and
 *  FREEZE holds the current vowel. ENV is the modulator's overall level. */
export const vocoder: ModuleSpec = {
  type: 'vocoder',
  title: 'VOCODER',
  name: 'Channel Vocoder',
  tagline: '16 bands: make a synth talk, or a beat sing; formant shift, sibilance, freeze; built-in carrier on V/OCT',
  category: 'Effects',
  hp: VOC_HP,
  panel: BLACK,
  inputs: vocIn,
  outputs: vocOut,
  params: vocParams,
  leds: VOC_BANDS,
  controls: [{ kind: 'text', text: 'BANDS', x: VOC_W / 2, y: METER_Y - 4, size: 1.8 }, ...meter, ...vocLayout.controls],
}

// ---- LPG ----
export const LPG_MODES = ['VCA', 'COMBO', 'LP']
const LPG_CH = [1, 2]
const lpgParams: ParamSpec[] = [
  ...LPG_CH.map((n): ParamSpec => ({ id: `off${n}`, label: 'OFFSET', min: 0, max: 1, def: 0, unit: '%' })),
  ...LPG_CH.map((n): ParamSpec => ({ id: `amt${n}`, label: 'CV AMT', min: 0, max: 1, def: 0.8, unit: '%' })),
  ...LPG_CH.map((n): ParamSpec => ({ id: `dec${n}`, label: 'DECAY', min: 0.05, max: 1.5, def: 0.35, curve: 'exp', unit: 's' })),
  ...LPG_CH.map((n): ParamSpec => ({ id: `mode${n}`, label: 'MODE', min: 0, max: 2, def: 1, stepped: true, options: LPG_MODES })),
]
const lpgIn: ModuleSpec['inputs'] = LPG_CH.flatMap((n) => [
  { id: `in${n}`, label: `IN ${n}` },
  { id: `cv${n}`, label: `CV ${n}` },
  { id: `strike${n}`, label: `STRIKE` },
])
const lpgOut: ModuleSpec['outputs'] = LPG_CH.map((n) => ({ id: `out${n}`, label: `OUT ${n}` }))
const LPG_HP = 10
const pair = (f: (n: number) => Control) => LPG_CH.map(f)
const lpgLayout = packRows(
  [
    pair((n) => knob(`off${n}`)),
    pair((n) => knob(`amt${n}`)),
    pair((n) => knob(`dec${n}`)),
    pair((n) => sw(`mode${n}`)),
    pair((n) => jack('in', `in${n}`)),
    pair((n) => jack('in', `cv${n}`)),
    pair((n) => jack('in', `strike${n}`)),
    pair((n) => jack('out', `out${n}`)),
  ],
  { params: lpgParams, inputs: lpgIn, outputs: lpgOut },
  LPG_HP * HP_MM,
  { grid: true },
)

/** Two low-pass gates in the Buchla tradition: a vactrol (a lamp lighting a
 *  photocell) opens a filter and an amp together. The cell is quick to light
 *  and slow to go dark, slower still as it closes, so a STRIKE (a trigger)
 *  gives the woody, natural "bongo" decay of west-coast patches. MODE: VCA
 *  (level only), COMBO (both, the classic), LP (tone only). CV is 0–10 V. */
export const lpg: ModuleSpec = {
  type: 'lpg',
  title: 'LPG',
  name: 'Dual Low-Pass Gate',
  tagline: 'Two vactrol low-pass gates: strike them for the woody west-coast "bongo"; VCA, COMBO or LP',
  category: 'Filters',
  hp: LPG_HP,
  panel: CREAM,
  inputs: lpgIn,
  outputs: lpgOut,
  params: lpgParams,
  controls: lpgLayout.controls,
}
