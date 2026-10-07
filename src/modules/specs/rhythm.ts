import type { Control, ModuleSpec, ParamSpec } from '../types'
import { DRUM } from './panels'

export const PAD_NAMES = ['BD', 'SD', 'CP', 'CH', 'OH', 'LT', 'MT', 'HT']
const padX = (i: number) => 12 + (i % 4) * 19

export const pads: ModuleSpec = {
  type: 'pads',
  title: 'PADS',
  name: 'Drum Pads',
  tagline: '8 velocity pads: click, number keys 1–8, or a MIDI pad controller (ch 10)',
  category: 'Controllers',
  hp: 16,
  panel: DRUM,
  inputs: [],
  outputs: [
    ...PAD_NAMES.map((_, i) => ({ id: `g${i + 1}`, label: String(i + 1) })),
    { id: 'vel', label: 'VEL' },
    { id: 'gate', label: 'GATE' },
    { id: 'cv', label: 'CV' },
  ],
  params: [],
  leds: 8,
  controls: [
    ...PAD_NAMES.map(
      (n, i): Control => ({ kind: 'pad', index: i, x: padX(i), y: i < 4 ? 30 : 50, size: 15, label: String(i + 1), sub: n, led: i }),
    ),
    ...PAD_NAMES.map((_, i): Control => ({ kind: 'out', jack: `g${i + 1}`, x: padX(i), y: i < 4 ? 74 : 92 })),
    { kind: 'out', jack: 'vel', x: 21.5, y: 111 },
    { kind: 'out', jack: 'gate', x: 40.6, y: 111 },
    { kind: 'out', jack: 'cv', x: 59.8, y: 111 },
  ],
}

const TRACKS = 8
const STEPS = 16
/** Default pattern A: four-on-the-floor, backbeat, eighth hats. */
const DEFAULT_A = [0x1111, 0x1010, 0, 0x5555, 0, 0, 0, 0, 0]

const maskParams = (prefix: string, defs: number[]): ParamSpec[] =>
  Array.from({ length: TRACKS + 1 }, (_, t) => ({
    id: `${prefix}${t}`,
    label: `${prefix.toUpperCase()} ${t < TRACKS ? t + 1 : 'ACC'}`,
    min: 0,
    max: 0xffff,
    def: defs[t] ?? 0,
    stepped: true,
  }))

const GX = 17
const GDX = 7.6
const recX = (i: number) => 38 + i * 11

/** Pattern selector positions. The A→B chain keeps value 2 so older patches load unchanged. */
export const TR_PATTERNS = ['A', 'B', 'A→B', 'C', 'D', 'A→D', 'AAAB']
/** Selector position → pattern it edits (−1 = chain: edit the playing one). */
export const TR_PATTERN_MAP = [0, 1, -1, 2, 3, -1, -1]
/** Selector position → chain order. */
export const TR_CHAINS: Record<number, number[]> = { 2: [0, 1], 5: [0, 1, 2, 3], 6: [0, 0, 0, 1] }

export const tr16: ModuleSpec = {
  type: 'tr16',
  title: 'TR-16',
  name: 'Drum Sequencer',
  tagline: '8 tracks × 16 steps + accent, swing, patterns A–D with song chains, live record',
  category: 'Sequencers',
  hp: 32,
  panel: DRUM,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
    ...Array.from({ length: TRACKS }, (_, i) => ({ id: `r${i + 1}`, label: `R${i + 1}` })),
  ],
  outputs: [
    { id: 'acc', label: 'ACC' },
    ...Array.from({ length: TRACKS }, (_, i) => ({ id: `t${i + 1}`, label: String(i + 1) })),
  ],
  params: [
    ...maskParams('a', DEFAULT_A),
    ...maskParams('b', []),
    ...maskParams('c', []),
    ...maskParams('d', []),
    { id: 'len', label: 'LENGTH', min: 1, max: STEPS, def: STEPS, stepped: true },
    { id: 'swing', label: 'SWING', min: 0, max: 0.9, def: 0, unit: '%' },
    { id: 'pat', label: 'PATTERN', min: 0, max: TR_PATTERNS.length - 1, def: 0, stepped: true, options: TR_PATTERNS },
    { id: 'rec', label: 'MODE', min: 0, max: 1, def: 0, stepped: true, options: ['PLAY', 'REC'] },
  ],
  leds: 3,
  controls: [
    {
      kind: 'steps',
      x: GX,
      y: 21,
      dx: GDX,
      dy: 6.6,
      cols: STEPS,
      rows: Array.from({ length: TRACKS + 1 }, (_, t) => ({
        label: t < TRACKS ? String(t + 1) : 'AC',
        p: ['a', 'b', 'c', 'd'].map((x) => `${x}${t}`),
      })),
      pattern: 'pat',
      patternMap: TR_PATTERN_MAP,
      length: 'len',
      stepLed: 0,
      patternLed: 1,
    },
    { kind: 'knob', param: 'len', x: 149, y: 25 },
    { kind: 'knob', param: 'swing', x: 149, y: 44 },
    { kind: 'knob', param: 'pat', x: 143, y: 64, size: 'S' },
    { kind: 'switch', param: 'rec', x: 155, y: 66 },
    { kind: 'led', index: 2, x: 155, y: 77, color: '#ff3b2f' },
    { kind: 'in', jack: 'clk', x: 10, y: 95 },
    { kind: 'in', jack: 'rst', x: 21, y: 95 },
    ...Array.from({ length: TRACKS }, (_, i): Control => ({ kind: 'in', jack: `r${i + 1}`, x: recX(i), y: 95 })),
    { kind: 'button', name: 'clear', x: 146, y: 95, label: 'CLEAR' },
    { kind: 'out', jack: 'acc', x: 21, y: 112 },
    ...Array.from({ length: TRACKS }, (_, i): Control => ({ kind: 'out', jack: `t${i + 1}`, x: recX(i), y: 112 })),
  ],
}
