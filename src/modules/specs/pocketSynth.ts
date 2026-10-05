import type { Control, ModuleSpec, ParamSpec } from '../types'
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

/** Mono bass: 16 note steps, slide and accent per step (303-style lines). */
export const pocketbass: ModuleSpec = {
  type: 'pocketbass',
  title: 'POCKET BASS',
  name: 'Pocket Bass',
  tagline: 'Calculator-sized bass synth: 16 note steps with slide and accent, sub / square / acid voices; syncs over CLK',
  category: 'Drums',
  hp: 16,
  panel: SAGE,
  inputs: [{ id: 'clk', label: 'CLK' }],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'clko', label: 'CLK' },
    { id: 'pitch', label: 'PITCH' },
    { id: 'gate', label: 'GATE' },
  ],
  params: [
    ...common(BASS_VOICES),
    // a little bassline to start from: root, octave, fifth, flat seventh
    // (step 9 slides up from step 8; steps 3 and 13 are accented)
    ...stepParams(BASS_NOTES, [0, 0, 0, 0, 12, 0, 0, 0, 7, 0, 0, 0, 10, 0, 12, 0], bit(1, 3, 5, 8, 9, 11, 13, 15), 3, [0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0]),
  ],
  leds: 3,
  controls: [
    { kind: 'surface', name: 'pocketkeys', x: 4, y: 14, w: 73.3, h: 74 },
    ...knobs([12, 26, 40], ['tempo', 'swing', 'vol'], 99),
    ...knobs([12, 26], ['voice', 'oct'], 113.5),
    { kind: 'in', jack: 'clk', x: 54, y: 99 },
    { kind: 'out', jack: 'pitch', x: 69, y: 99 },
    { kind: 'out', jack: 'gate', x: 40, y: 113.5 },
    { kind: 'out', jack: 'clko', x: 54, y: 113.5 },
    { kind: 'out', jack: 'out', x: 69, y: 113.5 },
  ],
}

const MX = [12, 27.5, 43, 58.5, 74, 89.5, 105]

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
  inputs: [{ id: 'clk', label: 'CLK' }],
  outputs: [
    { id: 'out', label: 'OUT' },
    { id: 'clko', label: 'CLK' },
    { id: 'pitch', label: 'PITCH' },
    { id: 'gate', label: 'GATE' },
    { id: 'notes', label: 'NOTES', poly: true },
  ],
  params: [
    ...common(MELODY_VOICES),
    { id: 'scale', label: 'SCALE', min: 0, max: SCALES.length - 1, def: 2, stepped: true, options: SCALES },
    { id: 'root', label: 'ROOT', min: 0, max: 11, def: 9, stepped: true, options: ROOTS },
    // a pentatonic phrase that ends on a chord
    ...stepParams(MELODY_NOTES, [7, 0, 5, 0, 6, 0, 4, 0, 5, 0, 3, 0, 4, 0, 2, 0], bit(1, 3, 5, 7, 9, 11, 13, 16), 2, [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  ],
  leds: 3,
  controls: [
    { kind: 'surface', name: 'pocketkeys', x: 4, y: 14, w: 113.9, h: 74 },
    ...knobs([MX[0], MX[1], MX[2], MX[3], MX[4]], ['tempo', 'swing', 'vol', 'scale', 'root'], 99),
    ...knobs([MX[0], MX[1]], ['voice', 'oct'], 113.5),
    { kind: 'in', jack: 'clk', x: MX[5], y: 99 },
    { kind: 'out', jack: 'notes', x: MX[6], y: 99 },
    { kind: 'out', jack: 'clko', x: MX[3], y: 113.5 },
    { kind: 'out', jack: 'pitch', x: MX[4], y: 113.5 },
    { kind: 'out', jack: 'gate', x: MX[5], y: 113.5 },
    { kind: 'out', jack: 'out', x: MX[6], y: 113.5 },
  ],
}

function knobs(xs: number[], params: string[], y: number): Control[] {
  return params.map((param, i) => ({ kind: 'knob', param, x: xs[i], y, size: 'S' }))
}
