import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { SAND } from './panels'
import { DEFAULT_CODE, MELODY_MAX, TALLY_MODES, TALLY_OCTAVES, TALLY_RHYTHMS, TALLY_SOUNDS, TLL } from './tallyDefs'

export const melodyId = (i: number) => `m${i}`

const params: ParamSpec[] = [
  { id: 'mode', label: 'MODE', min: 0, max: TALLY_MODES.length - 1, def: 1, stepped: true, options: TALLY_MODES },
  { id: 'sound', label: 'SOUND', min: 0, max: TALLY_SOUNDS.length - 1, def: 0, stepped: true, options: TALLY_SOUNDS },
  { id: 'oct', label: 'OCTAVE', min: 0, max: 2, def: 1, stepped: true, options: TALLY_OCTAVES },
  { id: 'rhythm', label: 'RHYTHM', min: 0, max: TALLY_RHYTHMS.length - 1, def: 2, stepped: true, options: TALLY_RHYTHMS.map((r) => r.name) },
  { id: 'tempo', label: 'TEMPO', min: 50, max: 220, def: 120, unit: 'bpm' },
  { id: 'balance', label: 'BALANCE', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'vol', label: 'VOLUME', min: 0, max: 1, def: 0.7, unit: '%' },
  { id: 'run', label: 'RHYTHM ON', min: 0, max: 1, def: 0, stepped: true, options: ['STOP', 'RUN'] },
  { id: 'code', label: 'ADSR CODE', min: 0, max: 99999999, def: DEFAULT_CODE, stepped: true },
  { id: 'mlen', label: 'MELODY LENGTH', min: 0, max: MELODY_MAX, def: 0, stepped: true },
  ...Array.from({ length: MELODY_MAX }, (_, i): ParamSpec => ({ id: melodyId(i), label: `MELODY NOTE ${i + 1}`, min: -1, max: 60, def: -1, stepped: true })),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'trig', label: 'ONE KEY' },
  { id: 'clk', label: 'CLK' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'out', label: 'OUT' },
  { id: 'pitch', label: 'PITCH' },
  { id: 'gateo', label: 'GATE' },
  { id: 'rhy', label: 'RHYTHM' },
]

const HP = 32
const W = HP * HP_MM
const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const layout = packRows(
  [
    [sw('mode'), knob('sound'), sw('oct'), knob('rhythm'), knob('tempo'), knob('balance'), knob('vol'), null],
    [...inputs.map((j) => jack('in', j.id)), ...outputs.map((j) => jack('out', j.id))],
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 2, maxPitch: 19 },
)

/** A calculator that plays (the VL-Tone tradition). PLAY: the key strip plays
 *  one of five little digital sounds, or your own ADSR sound. REC: what you
 *  play is remembered (up to 100 notes); then ONE KEY PLAY steps through it a
 *  note per press (or per pulse at ONE KEY, so the rack can play it in
 *  time). CAL: it's a calculator; ♪ plays the number on the display as a
 *  tune, and ADSR stores the display as the ADSR sound's eight-digit code
 *  (wave, attack, decay, sustain level, sustain time, release, vibrato,
 *  tremolo). Ten rhythms on three blip-and-noise sounds keep time. V/OCT
 *  and GATE play it from the rack; the keys also play from your keyboard. */
export const tally: ModuleSpec = {
  type: 'tally',
  title: 'TALLY',
  name: 'Tally Calculator Synth',
  tagline: 'A calculator that plays: five tiny digital sounds, a code-programmed ADSR voice, ten rhythms, one-key melody play',
  category: 'Instruments',
  hp: HP,
  panel: SAND,
  inputs,
  outputs,
  params,
  leds: TLL.end,
  controls: [{ kind: 'surface', name: 'tally', x: 4, y: 15, w: W - 8, h: layout.top - 15 - 3, bare: true }, ...layout.controls],
}
