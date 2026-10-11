import type { Control, ModuleSpec, ParamSpec } from '../types'
import { opts, pct, simpleSpec } from './build'
import { BLACK, CREAM } from './panels'

export const DM_STEPS = 16
/** LEDs: the step, then kick / snare / hat / accent flashes. */
export const DML = { step: 0, bd: 1, sd: 2, hh: 3, acc: 4 } as const

/** DRUM MAP: a map of drum patterns you move around. */
export const drummap: ModuleSpec = simpleSpec({
  type: 'drummap',
  title: 'DRUM MAP',
  name: 'Topographic Drum Sequencer',
  tagline: 'Glide across a map of grooves (four-on-the-floor, broken, boom bap, breakbeat, garage, jungle, Latin, footwork) with X and Y; density per drum; chaos',
  category: 'Sequencers',
  hp: 14,
  panel: BLACK,
  params: [
    pct('x', 'X', 0.3),
    pct('y', 'Y', 0.2),
    pct('dbd', 'KICK FILL', 0.5),
    pct('dsd', 'SNARE FILL', 0.5),
    pct('dhh', 'HAT FILL', 0.6),
    pct('chaos', 'CHAOS', 0),
    { id: 'tempo', label: 'TEMPO', min: 60, max: 200, def: 112, unit: 'bpm' },
    opts('run', 'PLAY', ['STOP', 'PLAY'], 1),
  ],
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
    { id: 'xcv', label: 'X CV' },
    { id: 'ycv', label: 'Y CV' },
  ],
  outputs: [
    { id: 'bd', label: 'KICK' },
    { id: 'sd', label: 'SNARE' },
    { id: 'hh', label: 'HAT' },
    { id: 'acc', label: 'ACCENT' },
  ],
  leds: DML.acc + 1,
  rows: [
    ['k:x', 'k:y', 'ks:chaos'],
    ['ks:dbd', 'ks:dsd', 'ks:dhh'],
    ['ks:tempo', 's:run'],
    ['i:clk', 'i:rst', 'i:xcv', 'i:ycv'],
    ['o:bd', 'o:sd', 'o:hh', 'o:acc'],
  ],
  top: (top, w) => [{ kind: 'surface', name: 'drummap', x: 4, y: 14, w: w - 8, h: top - 15.5 - 14 } as Control],
})

export const SC_STAGES = 8
export const SC_GATES = ['REST', 'FIRST', 'EACH', 'HOLD']
export const SC_SCALES = ['CHROMATIC', 'MAJOR', 'MINOR', 'DORIAN', 'PENTATONIC', 'BLUES']

/** STAIRCASE: stages, not steps. */
export const staircase: ModuleSpec = simpleSpec({
  type: 'staircase',
  title: 'STAIRCASE',
  name: 'Stage Sequencer',
  tagline: 'Eight stages, each a note held for 1–8 clock pulses that it plays once, on every pulse or tied, with slides: long phrases from few knobs',
  category: 'Sequencers',
  hp: 40,
  panel: CREAM,
  params: [
    ...Array.from({ length: SC_STAGES }, (_, i): ParamSpec[] => [
      { id: `p${i}`, label: `STAGE ${i + 1} NOTE`, min: 0, max: 24, def: [0, 3, 7, 10, 12, 10, 7, 5][i], stepped: true },
      { id: `n${i}`, label: `STAGE ${i + 1} PULSES`, min: 1, max: 8, def: [2, 1, 1, 2, 1, 1, 3, 1][i], stepped: true },
      opts(`g${i}`, `STAGE ${i + 1} GATE`, SC_GATES, [1, 2, 1, 3, 1, 1, 2, 0][i]),
      opts(`s${i}`, `STAGE ${i + 1} SLIDE`, ['OFF', 'SLIDE'], [0, 0, 0, 1, 0, 0, 0, 0][i]),
    ]).flat(),
    { id: 'len', label: 'STAGES', min: 1, max: SC_STAGES, def: SC_STAGES, stepped: true },
    opts('dir', 'DIRECTION', ['FORWARD', 'BACKWARD', 'PENDULUM', 'RANDOM'], 0),
    opts('scale', 'SCALE', SC_SCALES, 2),
    { id: 'glide', label: 'SLIDE TIME', min: 0.01, max: 1, def: 0.08, curve: 'exp', unit: 's' },
    { id: 'tempo', label: 'TEMPO', min: 40, max: 240, def: 118, unit: 'bpm' },
    opts('run', 'PLAY', ['STOP', 'PLAY'], 1),
  ],
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
    { id: 'trans', label: 'TRANSPOSE' },
  ],
  outputs: [
    { id: 'pitch', label: 'PITCH' },
    { id: 'gate', label: 'GATE' },
    { id: 'eos', label: 'END' },
  ],
  leds: SC_STAGES,
  grid: true,
  rows: [
    Array.from({ length: SC_STAGES }, (_, i) => `l:${i}`),
    Array.from({ length: SC_STAGES }, (_, i) => `ks:p${i}:NOTE ${i + 1}`),
    Array.from({ length: SC_STAGES }, (_, i) => `ks:n${i}:PULSES`),
    Array.from({ length: SC_STAGES }, (_, i) => `ks:g${i}:GATE`),
    Array.from({ length: SC_STAGES }, (_, i) => `s:s${i}`),
    ['ks:len', 'ks:dir', 'ks:scale', 'ks:glide', 'ks:tempo', 's:run', '-', '-'],
    ['i:clk', 'i:rst', 'i:trans', '-', '-', 'o:pitch', 'o:gate', 'o:eos'],
  ],
})

/** FORTUNE: random voltages that can be steered. */
export const fortune: ModuleSpec = simpleSpec({
  type: 'fortune',
  title: 'FORTUNE',
  name: 'Random Sampler',
  tagline: 'Random gates (a weighted coin) and random notes or CVs (spread, bias, steps into a scale), with DÉJÀ VU to make the randomness repeat',
  category: 'Sequencers',
  hp: 14,
  panel: BLACK,
  params: [
    { id: 'rate', label: 'RATE', min: 0.25, max: 16, def: 4, curve: 'exp', unit: 'Hz' },
    pct('tbias', 'COIN', 0.5),
    pct('jitter', 'JITTER', 0),
    pct('deja', 'DÉJÀ VU', 0.5),
    { id: 'loop', label: 'LOOP', min: 1, max: 16, def: 8, stepped: true },
    pct('spread', 'SPREAD', 0.5),
    pct('xbias', 'BIAS', 0.5),
    pct('steps', 'STEPS', 0.75),
    opts('scale', 'SCALE', ['MAJOR', 'MINOR', 'PENTATONIC', 'CHROMATIC'], 2),
  ],
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'dcv', label: 'DÉJÀ VU CV' },
    { id: 'scv', label: 'SPREAD CV' },
  ],
  outputs: [
    { id: 't1', label: 'T1' },
    { id: 't2', label: 'T2' },
    { id: 't3', label: 'CLOCK' },
    { id: 'x1', label: 'X1' },
    { id: 'x2', label: 'X2' },
    { id: 'x3', label: 'X3' },
    { id: 'y', label: 'Y' },
  ],
  leds: 3,
  rows: [
    ['k:rate', 'k:tbias', 'ks:jitter'],
    ['k:deja', 'ks:loop'],
    ['k:spread', 'k:xbias', 'k:steps'],
    ['ks:scale', 'l:0', 'l:1', 'l:2'],
    ['i:clk', 'i:dcv', 'i:scv'],
    ['o:t1', 'o:t2', 'o:t3', 'o:y'],
    ['o:x1', 'o:x2', 'o:x3'],
  ],
})
