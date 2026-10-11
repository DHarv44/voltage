import type { ModuleSpec } from '../types'
import { opts, pct, simpleSpec } from './build'
import { BLACK, CREAM } from './panels'

const ms = (id: string, label: string, def: number, max = 2): ModuleSpec['params'][number] => ({ id, label, min: 0.001, max, def, curve: 'exp', unit: 's' })

/** RATCHET: a clock multiplier and a burst generator in one. ×N runs N
 *  pulses in every clock period (measured from CLK); each TRIG fires a burst
 *  of N pulses spread across one period: the hi-hat roll, the snare build. */
export const ratchet: ModuleSpec = simpleSpec({
  type: 'ratchet',
  title: 'RATCHET',
  name: 'Clock Multiplier / Burst',
  tagline: 'Multiplies a clock ×1–8, and turns each trigger into a burst of 1–8 evenly spread hits (rolls, builds)',
  category: 'Sequencers',
  hp: 6,
  panel: BLACK,
  params: [
    { id: 'n', label: 'COUNT', min: 1, max: 8, def: 3, stepped: true },
    opts('curve', 'SPACING', ['EVEN', 'SPEED UP', 'SLOW DOWN'], 0),
  ],
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'trig', label: 'TRIG' },
    { id: 'ncv', label: 'COUNT CV' },
  ],
  outputs: [
    { id: 'mult', label: '×N' },
    { id: 'burst', label: 'BURST' },
  ],
  leds: 1,
  rows: [['k:n'], ['s:curve'], ['l:0'], ['i:clk', 'i:trig'], ['i:ncv'], ['o:mult', 'o:burst']],
})

/** GATE DELAY: holds a gate or trigger back by DELAY, then sets how long it
 *  lasts (LENGTH 0 keeps its own length): late hits, flams, swung offbeats,
 *  short triggers turned into long gates and back. */
export const gatedelay: ModuleSpec = simpleSpec({
  type: 'gatedelay',
  title: 'GATE DELAY',
  name: 'Gate Delay / Length',
  tagline: 'Delays gates and triggers and sets their length: flams, offsets, trigger-to-gate',
  category: 'CV Tools',
  hp: 6,
  panel: BLACK,
  params: [ms('delay', 'DELAY', 0.05), ms('len', 'LENGTH', 0.001, 4)],
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'dcv', label: 'DELAY CV' },
  ],
  outputs: [{ id: 'out', label: 'OUT' }],
  leds: 1,
  rows: [['k:delay'], ['k:len'], ['l:0'], ['i:in', 'i:dcv'], ['o:out']],
})

/** COMPARE: a comparator with hysteresis and a window: gates from any CV
 *  (an envelope crossing a level, an LFO's top half, a sound getting loud). */
export const compare: ModuleSpec = simpleSpec({
  type: 'compare',
  title: 'COMPARE',
  name: 'Window Comparator',
  tagline: 'Gates when a CV is above a level, below it, or inside a window; with hysteresis so noise doesn’t chatter',
  category: 'CV Tools',
  hp: 6,
  panel: BLACK,
  params: [
    { id: 'thr', label: 'LEVEL', min: -5, max: 10, def: 2.5, unit: 'V' },
    { id: 'win', label: 'WINDOW', min: 0, max: 10, def: 2, unit: 'V' },
    { id: 'hys', label: 'HYSTERESIS', min: 0, max: 2, def: 0.1, unit: 'V' },
  ],
  inputs: [
    { id: 'in', label: 'IN' },
    { id: 'tcv', label: 'LEVEL CV' },
  ],
  outputs: [
    { id: 'above', label: 'ABOVE' },
    { id: 'below', label: 'BELOW' },
    { id: 'inside', label: 'INSIDE' },
    { id: 'cross', label: 'CROSS' },
  ],
  leds: 1,
  rows: [['k:thr'], ['ks:win', 'ks:hys'], ['l:0'], ['i:in', 'i:tcv'], ['o:above', 'o:below'], ['o:inside', 'o:cross']],
})

/** CV MATH: two CVs combined: the lower and higher of them, their sum
 *  (shifted by OCTAVE and OFFSET) and difference, and A full-wave rectified. */
export const cvmath: ModuleSpec = simpleSpec({
  type: 'cvmath',
  title: 'CV MATH',
  name: 'CV Math',
  tagline: 'Min, max, sum (with octave and offset), difference and rectify for two CVs',
  category: 'CV Tools',
  hp: 6,
  panel: BLACK,
  params: [
    { id: 'oct', label: 'OCTAVE', min: -3, max: 3, def: 0, stepped: true },
    { id: 'off', label: 'OFFSET', min: -5, max: 5, def: 0, unit: 'V' },
  ],
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  outputs: [
    { id: 'sum', label: 'A+B' },
    { id: 'diff', label: 'A−B' },
    { id: 'min', label: 'MIN' },
    { id: 'max', label: 'MAX' },
    { id: 'rect', label: '|A|' },
  ],
  rows: [['k:oct'], ['ks:off'], ['i:a', 'i:b'], ['o:sum', 'o:diff'], ['o:min', 'o:max'], ['o:rect']],
})

/** XFADE: a voltage-controlled crossfader from A to B, constant power for
 *  sound or straight for CV. */
export const xfade: ModuleSpec = simpleSpec({
  type: 'xfade',
  title: 'XFADE',
  name: 'VC Crossfader',
  tagline: 'Fades between two signals by hand or by CV; equal power for audio, linear for CV',
  category: 'Amps & Mixers',
  hp: 6,
  panel: CREAM,
  params: [pct('pos', 'A ↔ B', 0.5), opts('law', 'LAW', ['POWER', 'LINEAR'], 0)],
  inputs: [
    { id: 'a', label: 'A', poly: true },
    { id: 'b', label: 'B', poly: true },
    { id: 'cv', label: 'CV' },
  ],
  outputs: [{ id: 'out', label: 'OUT', poly: true }],
  rows: [['kl:pos'], ['s:law'], ['i:a', 'i:b'], ['i:cv'], ['o:out']],
})

const notesLayout = (hp: number): ModuleSpec['controls'] => [{ kind: 'surface', name: 'notes', x: 3, y: 14, w: hp * 5.08 - 6, h: 108 }]

/** NOTES: a blank panel to write on: how the patch works, what to turn,
 *  who made it. Kept with the rack and its share links. */
export const notes: ModuleSpec = {
  type: 'notes',
  title: 'NOTES',
  name: 'Notes Panel',
  tagline: 'A panel to write on: explain the patch to whoever opens it next (kept with the rack and share links)',
  category: 'Output',
  hp: 12,
  panel: CREAM,
  params: [],
  inputs: [],
  outputs: [],
  controls: notesLayout(12),
  sizes: [8, 12, 16, 24],
  layout: notesLayout,
}

const eight = (kind: 'in' | 'out') => Array.from({ length: 8 }, (_, i) => ({ id: `${kind === 'in' ? 'i' : 'o'}${i + 1}`, label: String(i + 1) }))

/** SPLIT: a poly cable into its voices, one jack each. */
export const split: ModuleSpec = simpleSpec({
  type: 'split',
  title: 'SPLIT',
  name: 'Poly Split',
  tagline: 'A poly cable split into its eight voices',
  category: 'Polyphonic',
  hp: 6,
  panel: BLACK,
  params: [],
  inputs: [{ id: 'in', label: 'POLY', poly: true }],
  outputs: eight('out'),
  rows: [['i:in'], ['o:o1', 'o:o2'], ['o:o3', 'o:o4'], ['o:o5', 'o:o6'], ['o:o7', 'o:o8']],
})

/** MERGE: up to eight cables into one poly cable (as many voices as the
 *  highest patched jack). */
export const merge: ModuleSpec = simpleSpec({
  type: 'merge',
  title: 'MERGE',
  name: 'Poly Merge',
  tagline: 'Up to eight cables merged into one poly cable',
  category: 'Polyphonic',
  hp: 6,
  panel: BLACK,
  params: [],
  inputs: eight('in'),
  outputs: [{ id: 'out', label: 'POLY', poly: true }],
  rows: [['i:i1', 'i:i2'], ['i:i3', 'i:i4'], ['i:i5', 'i:i6'], ['i:i7', 'i:i8'], ['o:out']],
})

/** UNISON: each note on a poly cable becomes 2–8 voices spread in pitch
 *  (DETUNE), for a fat lead or a supersaw from any poly voice. */
export const unison: ModuleSpec = simpleSpec({
  type: 'unison',
  title: 'UNISON',
  name: 'Unison Spreader',
  tagline: 'Stacks each note into 2–8 detuned voices (V/OCT and GATE), for fat leads from any poly voice',
  category: 'Polyphonic',
  hp: 6,
  panel: BLACK,
  params: [
    { id: 'n', label: 'VOICES', min: 1, max: 8, def: 4, stepped: true },
    { id: 'det', label: 'DETUNE', min: 0, max: 0.5, def: 0.12, unit: 'st' },
  ],
  inputs: [
    { id: 'voct', label: 'V/OCT', poly: true },
    { id: 'gate', label: 'GATE', poly: true },
  ],
  outputs: [
    { id: 'pv', label: 'V/OCT', poly: true },
    { id: 'pg', label: 'GATE', poly: true },
  ],
  rows: [['k:n'], ['k:det'], ['i:voct', 'i:gate'], ['o:pv', 'o:pg']],
})
