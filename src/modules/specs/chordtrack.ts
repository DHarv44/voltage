import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { chordCode } from './combo/chords'
import { CREAM } from './panels'

export const CT_BARS = 32
export const CT_VOICINGS = ['CLOSE', 'DROP 2', 'OPEN']
/** LEDs: the bar playing (−1 stopped), which half (0 / 1), the chord sounding (code, −1 none). */
export const CTL = { bar: 0, half: 1, chord: 2 } as const

/** A bar's chord is stored as its code + 1 (0 = hold the chord before); its
 *  half-bar change the same way (0 = none). */
const FACTORY = [chordCode(9, 1), chordCode(5, 0), chordCode(0, 0), chordCode(7, 0)]

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const sw = (param: string): Control => ({ kind: 'switch', param, x: 0, y: 0 })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

const params: ParamSpec[] = [
  { id: 'tempo', label: 'TEMPO', min: 40, max: 220, def: 100, unit: 'bpm' },
  { id: 'bars', label: 'BARS', min: 1, max: CT_BARS, def: 8, stepped: true },
  { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
  { id: 'voicing', label: 'VOICING', min: 0, max: CT_VOICINGS.length - 1, def: 0, stepped: true, options: CT_VOICINGS },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ...Array.from({ length: CT_BARS }, (_, b): ParamSpec[] => [
    { id: `c${b}`, label: `BAR ${b + 1}`, min: 0, max: 12 * 16, def: b < 8 ? FACTORY[b % 4] + 1 : 0, stepped: true },
    { id: `h${b}`, label: `BAR ${b + 1} HALF`, min: 0, max: 12 * 16, def: 0, stepped: true },
  ]).flat(),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
  { id: 'trans', label: 'KEY' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'notes', label: 'NOTES', poly: true },
  { id: 'gate', label: 'GATE', poly: true },
  { id: 'root', label: 'ROOT' },
  { id: 'chg', label: 'CHANGE' },
]
const HP = 30
const W = HP * HP_MM
const layout = packRows(
  [
    [knob('tempo'), knob('bars'), knob('oct'), sw('voicing'), sw('run'), null, null],
    [jack('in', 'clk'), jack('in', 'rst'), jack('in', 'trans'), jack('out', 'notes'), jack('out', 'gate'), jack('out', 'root'), jack('out', 'chg')],
  ],
  { params, inputs, outputs },
  W,
  { grid: true, gap: 1.4 },
)

/** CHORD TRACK: the song's chords written out, a chord a bar (and a change
 *  on the half bar if you want one), up to 32 bars. They come out voice-led
 *  on a poly cable (each voice moving as little as it can) with a gate per
 *  voice that retriggers on every change, the root an octave or two down for
 *  the bass, and KEY in to transpose the lot (ARRANGER XL's KEY for a
 *  key change). Its own tempo, or 16ths on CLK. */
export const chordtrack: ModuleSpec = {
  type: 'chordtrack',
  title: 'CHORD TRACK',
  name: 'Chord Track',
  tagline: 'Write the song’s chords bar by bar (half-bar changes too); voice-led poly notes and gates, the bass root, KEY transpose; its own tempo or CLK',
  category: 'Sequencers',
  hp: HP,
  panel: CREAM,
  inputs,
  outputs,
  params,
  leds: 3,
  controls: [{ kind: 'surface', name: 'chordtrack', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
