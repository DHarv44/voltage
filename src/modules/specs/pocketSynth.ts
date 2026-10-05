import { BEZEL, packRows, type SpecLabels } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLUSH, SAGE } from './panels'

/** The melodic members of the POCKET family: same 16-step, calculator-sized
 *  idea as the drum POCKET (same clock, CLK out → CLK in to play as a band),
 *  but each step holds a note. */
export const PSTEPS = 16
export const BASS_VOICES = ['SUB', 'SQUARE', 'ACID']
export const MELODY_VOICES = ['BELL', 'PLUCK', 'LEAD']
export const SCALES = ['MAJOR', 'MINOR', 'PENTA', 'DORIAN']
export const SCALE_STEPS = [
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 4, 7, 9],
  [0, 2, 3, 5, 7, 9, 10],
]
export const ROOTS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
/** Highest note value a step can hold: semitones (bass) or scale steps (melody). */
export const BASS_NOTES = 24
export const MELODY_NOTES = 14
/** Per-step flags. Bass: bit 0 = slide into this note, bit 1 = accent.
 *  Melody: 0 = single note, 1 = chord (triad in the scale), 2 = arpeggio. */
export const MELODY_MODES = ['NOTE', 'CHORD', 'ARP']

/** Telemetry: the step playing, a note flash, and the note sounding. */
export const PSL = { step: 0, flash: 1, note: 2 } as const

function stepParams(max: number, defNotes: number[], defMask: number, flagMax: number, defFlags: number[] = []): ParamSpec[] {
  return [
    { id: 'm', label: 'STEPS', min: 0, max: 0xffff, def: defMask, stepped: true },
    ...Array.from({ length: PSTEPS }, (_, i): ParamSpec => ({ id: `n${i}`, label: `NOTE ${i + 1}`, min: 0, max, def: defNotes[i] ?? 0, stepped: true })),
    ...Array.from({ length: PSTEPS }, (_, i): ParamSpec => ({ id: `f${i}`, label: `FLAG ${i + 1}`, min: 0, max: flagMax, def: defFlags[i] ?? 0, stepped: true })),
  ]
}

const common = (voices: string[]): ParamSpec[] => [
  { id: 'tempo', label: 'BPM', min: 60, max: 200, def: 112, unit: 'bpm' },
  { id: 'swing', label: 'SWING', min: 0, max: 0.5, def: 0.08, unit: '%' },
  { id: 'vol', label: 'VOLUME', min: 0, max: 1, def: 0.7, unit: '%' },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 0, stepped: true, options: ['STOP', 'PLAY'] },
  { id: 'write', label: 'WRITE', min: 0, max: 1, def: 1, stepped: true, options: ['PLAY', 'WRITE'] },
  { id: 'voice', label: 'VOICE', min: 0, max: voices.length - 1, def: 0, stepped: true, options: voices },
  { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
  { id: 'a', label: 'A · TONE', min: 0, max: 1, def: 0.45 },
  { id: 'b', label: 'B · DECAY', min: 0, max: 1, def: 0.4 },
]

const bit = (...steps: number[]) => steps.reduce((m, s) => m | (1 << (s - 1)), 0)

const knob = (param: string): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })

/** The POCKETs' panel: the face on top, the knobs and jacks in a grid below
 *  (packed so labels and plates never touch); the face takes the rest. */
function pocketLayout(hp: number, spec: SpecLabels, rows: (Control | null)[][]): Control[] {
  const w = hp * HP_MM
  const { controls, top } = packRows(rows, spec, w, { grid: true })
  return [{ kind: 'surface', name: 'pocketkeys', x: 4, y: 14, w: w - 8, h: top - BEZEL - 0.8 - 14 }, ...controls]
}

const CLK_IN: ModuleSpec['inputs'] = [{ id: 'clk', label: 'CLK' }]
const SYNTH_OUTS: ModuleSpec['outputs'] = [
  { id: 'out', label: 'OUT' },
  { id: 'clko', label: 'CLK' },
  { id: 'pitch', label: 'PITCH' },
  { id: 'gate', label: 'GATE' },
]
const BASS_OUTS = SYNTH_OUTS
const MELODY_OUTS: ModuleSpec['outputs'] = [...SYNTH_OUTS, { id: 'notes', label: 'NOTES', poly: true }]

const BASS_PARAMS: ParamSpec[] = [
  ...common(BASS_VOICES),
  // a little bassline to start from: root, octave, fifth, flat seventh
  // (step 9 slides up from step 8; steps 3 and 13 are accented)
  ...stepParams(BASS_NOTES, [0, 0, 0, 0, 12, 0, 0, 0, 7, 0, 0, 0, 10, 0, 12, 0], bit(1, 3, 5, 8, 9, 11, 13, 15), 3, [0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0]),
]

const MELODY_PARAMS: ParamSpec[] = [
  ...common(MELODY_VOICES),
  { id: 'scale', label: 'SCALE', min: 0, max: SCALES.length - 1, def: 2, stepped: true, options: SCALES },
  { id: 'root', label: 'ROOT', min: 0, max: 11, def: 9, stepped: true, options: ROOTS },
  // a pentatonic phrase that ends on a chord
  ...stepParams(MELODY_NOTES, [7, 0, 5, 0, 6, 0, 4, 0, 5, 0, 3, 0, 4, 0, 2, 0], bit(1, 3, 5, 7, 9, 11, 13, 16), 2, [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
]

/** Mono bass: 16 note steps, slide and accent per step (303-style lines). */
export const pocketbass: ModuleSpec = {
  type: 'pocketbass',
  title: 'POCKET BASS',
  name: 'Pocket Bass',
  tagline: 'Calculator-sized bass synth: 16 note steps with slide and accent, sub / square / acid voices; syncs over CLK',
  category: 'Drums',
  hp: 16,
  panel: SAGE,
  inputs: CLK_IN,
  outputs: BASS_OUTS,
  params: BASS_PARAMS,
  leds: 3,
  controls: pocketLayout(16, { params: BASS_PARAMS, inputs: CLK_IN, outputs: BASS_OUTS }, [
    [knob('tempo'), knob('swing'), knob('vol'), jack('in', 'clk'), jack('out', 'pitch')],
    [knob('voice'), knob('oct'), jack('out', 'gate'), jack('out', 'clko'), jack('out', 'out')],
  ]),
}

/** Lead/melody: steps are scale degrees (it can't play a wrong note), each one
 *  a single note, a chord or an arpeggio. */
export const pocketmelody: ModuleSpec = {
  type: 'pocketmelody',
  title: 'POCKET MELODY',
  name: 'Pocket Melody',
  tagline: 'Calculator-sized melody synth: notes from a scale, per-step chords and arpeggios, bell / pluck / lead; syncs over CLK',
  category: 'Drums',
  hp: 24,
  panel: BLUSH,
  inputs: CLK_IN,
  outputs: MELODY_OUTS,
  params: MELODY_PARAMS,
  leds: 3,
  controls: pocketLayout(24, { params: MELODY_PARAMS, inputs: CLK_IN, outputs: MELODY_OUTS }, [
    [knob('tempo'), knob('swing'), knob('vol'), knob('scale'), knob('root'), jack('in', 'clk'), jack('out', 'notes')],
    [knob('voice'), knob('oct'), null, jack('out', 'clko'), jack('out', 'pitch'), jack('out', 'gate'), jack('out', 'out')],
  ]),
}
