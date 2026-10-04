import type { Control, ModuleSpec, ParamSpec } from '../types'
import { DRUM } from './panels'

const PATCH_X = [163.5, 174.5, 185.5, 196.5]
const VOICE_X = [18, 47, 76, 105, 134]
const VOICES = [
  { id: 'bd', name: 'KICK', k: ['bd_tune', 'bd_decay'] },
  { id: 'sd', name: 'SNARE', k: ['sd_tune', 'sd_snap'] },
  { id: 'cp', name: 'CLAP', k: ['cp_tone', 'cp_decay'] },
  { id: 'ch', name: 'CLOSED HAT', k: ['hh_metal', 'ch_decay'] },
  { id: 'oh', name: 'OPEN HAT', k: ['hh_tone', 'oh_decay'] },
]
const TRACK_LABELS = ['BD', 'SD', 'CP', 'CH', 'OH', 'AC']
/** A: classic house; B: busier fill. Rows: BD, SD, CP, CH, OH, ACCENT. */
const PAT_A = [0x1111, 0x1010, 0x0000, 0x1555, 0x4000, 0x0101]
const PAT_B = [0x1511, 0x9010, 0x1000, 0x1555, 0x4000, 0x0101]

const mask = (prefix: string, defs: number[]): ParamSpec[] =>
  TRACK_LABELS.map((l, t) => ({ id: `${prefix}${t}`, label: `${prefix.toUpperCase()} ${l}`, min: 0, max: 0xffff, def: defs[t], stepped: true }))

const inputs = [
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
  { id: 't_bd', label: 'BD' },
  { id: 't_sd', label: 'SD' },
  { id: 't_cp', label: 'CP' },
  { id: 't_ch', label: 'CH' },
  { id: 't_oh', label: 'OH' },
  { id: 'acc', label: 'ACC' },
]
const outputs = [
  { id: 'bd', label: 'BD' },
  { id: 'sd', label: 'SD' },
  { id: 'cp', label: 'CP' },
  { id: 'hh', label: 'HATS' },
  { id: 'mix', label: 'MIX' },
  { id: 'clk', label: 'CLK' },
  { id: 'acc', label: 'ACC' },
]

/** Drum-machine system unit: five analog voices, pads, a 16-step sequencer
 *  with internal tempo, and a patch bay. Each voice's trigger is normalled
 *  to its sequencer track; patching a trigger input takes over. */
export const groove: ModuleSpec = {
  type: 'groove',
  title: 'GROOVE-1',
  name: 'GROOVE-1 Drum Machine',
  tagline: 'Five analog voices + pads + 16-step sequencer; plays on its own, patch bay overrides',
  category: 'Systems',
  hp: 40,
  panel: DRUM,
  inputs,
  outputs,
  params: [
    { id: 'bd_tune', label: 'TUNE', min: 30, max: 120, def: 50, curve: 'exp', unit: 'Hz' },
    { id: 'bd_decay', label: 'DECAY', min: 0.05, max: 2, def: 0.45, curve: 'exp', unit: 's' },
    { id: 'sd_tune', label: 'TUNE', min: 120, max: 400, def: 190, curve: 'exp', unit: 'Hz' },
    { id: 'sd_snap', label: 'SNAPPY', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'cp_tone', label: 'TONE', min: 600, max: 3000, def: 1100, curve: 'exp', unit: 'Hz' },
    { id: 'cp_decay', label: 'DECAY', min: 0.05, max: 1, def: 0.3, curve: 'exp', unit: 's' },
    { id: 'hh_metal', label: 'METAL', min: 0.5, max: 2, def: 1, curve: 'exp', unit: 'x' },
    { id: 'ch_decay', label: 'DECAY', min: 0.01, max: 0.25, def: 0.05, curve: 'exp', unit: 's' },
    { id: 'hh_tone', label: 'TONE', min: 4000, max: 12000, def: 7500, curve: 'exp', unit: 'Hz' },
    { id: 'oh_decay', label: 'DECAY', min: 0.1, max: 2, def: 0.45, curve: 'exp', unit: 's' },
    ...mask('a', PAT_A),
    ...mask('b', PAT_B),
    { id: 'tempo', label: 'TEMPO', min: 40, max: 240, def: 118, curve: 'exp', unit: 'bpm' },
    { id: 'swing', label: 'SWING', min: 0, max: 0.9, def: 0.1, unit: '%' },
    { id: 'len', label: 'LENGTH', min: 1, max: 16, def: 16, stepped: true },
    { id: 'accent', label: 'ACCENT', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'vol', label: 'VOLUME', min: 0, max: 1, def: 0.6, unit: '%' },
    { id: 'run', label: 'RUN', min: 0, max: 1, def: 0, stepped: true, options: ['STOP', 'RUN'] },
    { id: 'rec', label: 'MODE', min: 0, max: 1, def: 0, stepped: true, options: ['PLAY', 'REC'] },
    { id: 'pat', label: 'PATTERN', min: 0, max: 2, def: 0, stepped: true, options: ['A', 'B', 'A→B'] },
  ],
  leds: 9,
  controls: [
    { kind: 'section', x: 3, y: 16, w: 150, h: 46, label: 'VOICES' },
    ...VOICES.flatMap((v, i): Control[] => [
      { kind: 'text', text: v.name, x: VOICE_X[i], y: 22.5, size: 2.2 },
      { kind: 'knob', param: v.k[0], x: VOICE_X[i] - 7.5, y: 31 },
      { kind: 'knob', param: v.k[1], x: VOICE_X[i] + 7.5, y: 31 },
      { kind: 'pad', index: i, x: VOICE_X[i], y: 51.5, size: 11, label: String(i + 1), sub: TRACK_LABELS[i], led: 2 + i },
    ]),
    { kind: 'section', x: 3, y: 65, w: 150, h: 36, label: 'SEQUENCER' },
    {
      kind: 'steps',
      x: 20,
      y: 70.5,
      dx: 8.25,
      dy: 5.6,
      cols: 16,
      rows: TRACK_LABELS.map((label, t) => ({ label, a: `a${t}`, b: `b${t}` })),
      pattern: 'pat',
      length: 'len',
      stepLed: 0,
      patternLed: 1,
    },
    { kind: 'knob', param: 'tempo', x: 12, y: 110 },
    { kind: 'led', index: 8, x: 19.5, y: 104.5, color: '#ff6a1a' },
    { kind: 'knob', param: 'swing', x: 30, y: 110 },
    { kind: 'knob', param: 'len', x: 48, y: 110 },
    { kind: 'knob', param: 'accent', x: 66, y: 110 },
    { kind: 'knob', param: 'vol', x: 84, y: 110 },
    { kind: 'switch', param: 'run', x: 100, y: 110 },
    { kind: 'switch', param: 'rec', x: 113, y: 110 },
    { kind: 'led', index: 7, x: 119.5, y: 110, color: '#ff3b2f' },
    { kind: 'switch', param: 'pat', x: 127, y: 110 },
    { kind: 'button', name: 'clear', x: 145, y: 110, label: 'CLEAR' },

    { kind: 'section', x: 156, y: 16, w: 45.5, h: 96, label: 'PATCH BAY' },
    { kind: 'text', text: 'INPUTS', x: 178.5, y: 22.5, size: 1.8 },
    ...inputs.map((j, i): Control => ({ kind: 'in', jack: j.id, x: PATCH_X[i % 4], y: [32, 50][Math.floor(i / 4)] })),
    { kind: 'text', text: 'OUTPUTS', x: 178.5, y: 64, size: 1.8 },
    ...outputs.map((j, i): Control => ({ kind: 'out', jack: j.id, x: PATCH_X[i % 4], y: [80, 98][Math.floor(i / 4)] })),
    { kind: 'text', text: 'TRIGGER INPUTS OVERRIDE THE SEQUENCER', x: 178.5, y: 109, size: 1.4 },
  ],
}
