import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { DRUM } from './panels'

export const DB_PADS = 16
export const DB_FX = ['VINYL', 'CRUSH', 'FILTER', 'STUTTER', 'TAPE STOP', 'DUB']
/** The factory pads (the rest start empty, for your recordings). */
export const DB_FACTORY = ['KICK', 'SNARE', 'HAT', 'ORCH', 'HEY!', 'BASS', 'BELL', 'KEYS']
/** LEDs: pads 0–15 glow, then REC (armed / recording), FX on, how full a recording is. */
export const DBL = { rec: DB_PADS, fx: DB_PADS + 1, fill: DB_PADS + 2 } as const

const PAD_X = [10, 23, 36, 49]
const PAD_Y = [74, 61, 48, 35]
const knob = (param: string, x: number, y: number): Control => ({ kind: 'knob', param, x, y, size: 'S' })

const params: ParamSpec[] = [
  { id: 'fx', label: 'EFFECT', min: 0, max: DB_FX.length - 1, def: 0, stepped: true, options: DB_FX },
  { id: 'amount', label: 'AMOUNT', min: 0, max: 1, def: 0.35, unit: '%' },
  { id: 'latch', label: 'LATCH', min: 0, max: 1, def: 0, stepped: true, options: ['HOLD', 'LATCH'] },
  { id: 'grit', label: 'GRIT', min: 0, max: 1, def: 0.4, unit: '%' },
  { id: 'comp', label: 'COMP', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'pitch', label: 'PITCH', min: -12, max: 12, def: 0, unit: 'st' },
  { id: 'tempo', label: 'TEMPO', min: 60, max: 180, def: 90, unit: 'bpm' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'trig', label: 'TRIG' },
  { id: 'pcv', label: 'PAD' },
  { id: 'clk', label: 'CLK' },
  { id: 'fxg', label: 'FX' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]
const HP = 30
const jacks = packRows(
  [[...inputs.map((j): Control => ({ kind: 'in', jack: j.id, x: 0, y: 0 })), ...outputs.map((j): Control => ({ kind: 'out', jack: j.id, x: 0, y: 0 }))]],
  { params, inputs, outputs },
  HP * HP_MM,
  { maxPitch: 20 },
)

/** DUSTBOX: a lo-fi sampler for beat-making (our own take on the pocket
 *  samplers of the 2000s): sixteen pads, the first eight with factory sounds
 *  (a kit cut from a break, stabs, a bass, a bell, keys), the rest for what
 *  you record: press REC, then a pad, and it records IN until you press REC
 *  again; RESAMPLE records the box's own output, effects and all, into the
 *  next free pad. Hold FX (or LATCH it) to punch an effect in over
 *  everything: VINYL, CRUSH, FILTER (left low-pass, right high-pass), STUTTER
 *  (in time), TAPE STOP, DUB echo. GRIT is the 12-bit converter, COMP the
 *  squashing bus compressor the sound is known for. Pads play from the
 *  screen, MIDI drum notes, or TRIG with PAD (0–10 V picks the pad). */
export const dustbox: ModuleSpec = {
  type: 'dustbox',
  title: 'DUSTBOX',
  name: 'Dustbox (Lo-fi Sampler)',
  tagline: 'A lo-fi beat sampler: 16 pads, record and resample, hold-to-punch effects (vinyl, crush, filter, stutter, tape stop, dub), 12-bit grit and a squashing compressor',
  category: 'Sampling & Tape',
  hp: HP,
  panel: DRUM,
  inputs,
  outputs,
  params,
  leds: DB_PADS + 3,
  controls: [
    ...Array.from({ length: DB_PADS }, (_, i): Control => ({
      kind: 'pad',
      index: i,
      x: PAD_X[i % 4],
      y: PAD_Y[Math.floor(i / 4)],
      size: 11,
      label: String(i + 1),
      sub: DB_FACTORY[i] ?? '',
      led: i,
    })),
    { kind: 'button', name: 'rec', x: 68, y: 22, label: 'REC', led: DBL.rec, ledColor: '#ff3b2f' },
    { kind: 'button', name: 'resample', x: 84, y: 22, label: 'RESAMPLE' },
    { kind: 'button', name: 'fx', x: 104, y: 22, label: 'FX', led: DBL.fx, ledColor: '#ffd25a' },
    knob('fx', 68, 42),
    knob('amount', 84, 42),
    { kind: 'switch', param: 'latch', x: 100, y: 42 },
    knob('grit', 68, 62),
    knob('comp', 84, 62),
    knob('pitch', 100, 62),
    knob('tempo', 116, 62),
    knob('level', 132, 62),
    { kind: 'progress', x: 4, y: 84, w: 52, led: DBL.fill },
    ...jacks.controls,
  ],
}
