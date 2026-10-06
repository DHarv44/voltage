import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { SAND } from './panels'

/** SKETCHBOOK: a portable workstation in the OP-1 tradition (our own design):
 *  four encoders that mean whatever the mode says, a handful of synth
 *  engines with four knobs each, a pattern sequencer, a 4-track loop tape
 *  and a mixer, on a keybed with a screen. */

export const SB_MODES = ['SYNTH', 'SEQ', 'TAPE', 'MIX']
export const SYNTH = 0
export const SEQ = 1
export const TAPE = 2
export const MIX = 3
export const SB_PAGES = ['SOUND', 'ENVELOPE', 'FX', 'LFO']
export const SB_FX = ['OFF', 'DELAY', 'CHORUS', 'PHONE', 'CRUSH']
/** The FX page's A and B knobs mean different things per effect. */
const FX_KNOBS = [
  ['—', '—'],
  ['TIME', 'FEEDBK'],
  ['RATE', 'DEPTH'],
  ['TONE', 'DRIVE'],
  ['BITS', 'RATE'],
]
/** SEQ's types: PATTERN (step-recorded), ARP (the keys you hold), TUMBLE
 *  (balls in a spinning drum; wall k plays step k's note), DRIFT (the pattern,
 *  mutating a little each time round). */
export const SB_SEQS = ['PATTERN', 'ARP', 'TUMBLE', 'DRIFT']
export const PATTERN = 0
export const ARP = 1
export const TUMBLE = 2
export const DRIFT = 3
export const SB_ARP_RATES = ['1/4', '1/8', '1/16', '1/32']
export const SB_ARP_MODES = ['UP', 'DOWN', 'UPDOWN', 'RANDOM']
/** Notes an arpeggio holds; balls in the drum. */
export const SB_ARP_MAX = 8
export const SB_BALLS = 4
export const SB_LFO_SHAPES = ['SINE', 'TRIANGLE', 'SQUARE', 'RANDOM']
export const SB_LFO_DESTS = ['PITCH', 'KNOB 1', 'KNOB 3', 'VOLUME']
export const SB_ENGINES = ['TWIN', 'DUO', 'PLUCK', 'SWARM', 'PHASE', 'DUST', 'WAVE']
/** Each engine's four knobs (names, and where they start). */
export const SB_ENGINE_KNOBS: { names: string[]; defs: number[] }[] = [
  { names: ['SHAPE', 'DETUNE', 'CUTOFF', 'RESO'], defs: [0.3, 0.35, 0.5, 0.3] },
  { names: ['RATIO', 'INDEX', 'FEEDBK', 'DECAY'], defs: [0.2, 0.4, 0.15, 0.4] },
  { names: ['DAMP', 'BRIGHT', 'BODY', 'PLUCK'], defs: [0.6, 0.6, 0.5, 0.25] },
  { names: ['DETUNE', 'SPREAD', 'CUTOFF', 'SUB'], defs: [0.45, 0.6, 0.6, 0.2] },
  { names: ['WAVE', 'DCW', 'ENV', 'RESO'], defs: [0.1, 0.6, 0.6, 0.4] },
  { names: ['COLOR', 'RING', 'GRIT', 'BODY'], defs: [0.3, 0.7, 0.2, 0.3] },
  { names: ['POSITION', 'WARP', 'CUTOFF', 'TWIN'], defs: [0.4, 0.2, 0.6, 0.4] },
]
/** The four encoder colours, left to right (also the screen's colour code). */
export const SB_COLORS = ['#ff6b5b', '#ffbe3d', '#3ddc97', '#4aa8ff']
export const SB_STEPS = 16
export const SB_TRACKS = 4
export const SB_VOICES = 6
/** Keybed: two octaves (25 keys) from C, OCTAVE shifts it. */
export const SB_KEYS = 25
/** Longest tape loop (s): 8 bars at 60 bpm. */
export const SB_TAPE_S = 32

/** Engine → screen state on the LED channel: transport and meters, then the
 *  drum (angle, x,y per ball), the drifting pattern, the arpeggio's notes. */
const L0 = 7 + SB_TRACKS
export const SBL = {
  step: 0,
  pos: 1,
  rec: 2,
  run: 3,
  peak: 4,
  live: 4 + SB_TRACKS,
  note: 5 + SB_TRACKS,
  voices: 6 + SB_TRACKS,
  angle: L0,
  balls: L0 + 1,
  drift: L0 + 1 + SB_BALLS * 2,
  arpCount: L0 + 1 + SB_BALLS * 2 + SB_STEPS,
  arp: L0 + 2 + SB_BALLS * 2 + SB_STEPS,
  end: L0 + 2 + SB_BALLS * 2 + SB_STEPS + SB_ARP_MAX,
} as const

/** The four encoders' params in a mode (SYNTH: the engine's knobs, or the
 *  envelope on page 2). Shared by the face and the docs. */
export function encoderParams(mode: number, page: number, engine: number, seq = PATTERN): string[] {
  switch (mode) {
    case SEQ:
      if (seq === ARP) return ['tempo', 'arate', 'aoct', 'amode']
      if (seq === TUMBLE) return ['tspin', 'tgrav', 'tballs', 'len']
      if (seq === DRIFT) return ['tempo', 'len', 'dchange', 'glen']
      return ['tempo', 'len', 'swing', 'glen']
    case TAPE:
      return ['bars', 'trk', 'drive', 'vol']
    case MIX:
      return ['lv0', 'lv1', 'lv2', 'lv3']
    default:
      if (page === 1) return ['a', 'd', 's', 'r']
      if (page === 2) return ['fx', 'fxmix', 'fxa', 'fxb']
      if (page === 3) return ['lfo', 'lrate', 'ldepth', 'ldest']
      return [0, 1, 2, 3].map((i) => `k${engine}_${i}`)
  }
}

/** What the four encoders are called right now (the FX knobs and the LFO's
 *  destination name the actual thing they move). */
export function encoderLabels(p: Record<string, number>, fallback: (id: string) => string): string[] {
  const mode = Math.round(p.mode)
  const page = Math.round(p.page)
  const engine = Math.round(p.engine)
  if (mode === SYNTH && page === 0) return SB_ENGINE_KNOBS[engine].names
  if (mode === SYNTH && page === 2) {
    const [a, b] = FX_KNOBS[Math.round(p.fx)] ?? FX_KNOBS[0]
    return ['EFFECT', 'MIX', a, b]
  }
  if (mode === SEQ && Math.round(p.stype) === TUMBLE) return ['SPIN', 'GRAVITY', 'BALLS', 'SIDES']
  return encoderParams(mode, page, engine, Math.round(p.stype)).map(fallback)
}

/** The LFO's destination, named for the selected engine (KNOB 1 → SHAPE …). */
export function lfoTarget(p: Record<string, number>): string {
  const d = Math.round(p.ldest)
  const names = SB_ENGINE_KNOBS[Math.round(p.engine)].names
  return d === 1 ? names[0] : d === 2 ? names[2] : SB_LFO_DESTS[d]
}

/** A pattern to start from: a minor-pentatonic phrase (semitones above the
 *  keybed's C; −1 = rest). */
const START = [0, -1, 7, -1, 10, 12, -1, 7, 5, -1, 3, -1, 7, 10, -1, 12]

const params: ParamSpec[] = [
  { id: 'mode', label: 'MODE', min: 0, max: SB_MODES.length - 1, def: SYNTH, stepped: true, options: SB_MODES },
  { id: 'page', label: 'PAGE', min: 0, max: SB_PAGES.length - 1, def: 0, stepped: true, options: SB_PAGES },
  { id: 'engine', label: 'ENGINE', min: 0, max: SB_ENGINES.length - 1, def: 0, stepped: true, options: SB_ENGINES },
  { id: 'oct', label: 'OCTAVE', min: -2, max: 2, def: 0, stepped: true },
  ...SB_ENGINE_KNOBS.flatMap((e, ei) => e.names.map((label, i) => ({ id: `k${ei}_${i}`, label, min: 0, max: 1, def: e.defs[i], unit: '%' as const }))),
  { id: 'a', label: 'ATTACK', min: 0.001, max: 4, def: 0.005, curve: 'exp', unit: 's' },
  { id: 'd', label: 'DECAY', min: 0.01, max: 4, def: 0.35, curve: 'exp', unit: 's' },
  { id: 's', label: 'SUSTAIN', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'r', label: 'RELEASE', min: 0.01, max: 6, def: 0.4, curve: 'exp', unit: 's' },
  { id: 'fx', label: 'EFFECT', min: 0, max: SB_FX.length - 1, def: 1, stepped: true, options: SB_FX },
  { id: 'fxmix', label: 'FX MIX', min: 0, max: 1, def: 0.3, unit: '%' },
  { id: 'fxa', label: 'FX A', min: 0, max: 1, def: 0.5, unit: '%' },
  { id: 'fxb', label: 'FX B', min: 0, max: 1, def: 0.4, unit: '%' },
  { id: 'lfo', label: 'LFO SHAPE', min: 0, max: SB_LFO_SHAPES.length - 1, def: 0, stepped: true, options: SB_LFO_SHAPES },
  { id: 'lrate', label: 'LFO RATE', min: 0.05, max: 20, def: 2, curve: 'exp', unit: 'Hz' },
  { id: 'ldepth', label: 'LFO DEPTH', min: 0, max: 1, def: 0, unit: '%' },
  { id: 'ldest', label: 'LFO TO', min: 0, max: SB_LFO_DESTS.length - 1, def: 2, stepped: true, options: SB_LFO_DESTS },
  { id: 'tempo', label: 'TEMPO', min: 40, max: 240, def: 100, unit: 'bpm' },
  { id: 'len', label: 'LENGTH', min: 1, max: SB_STEPS, def: SB_STEPS, stepped: true },
  { id: 'swing', label: 'SWING', min: 0, max: 0.5, def: 0.05, unit: '%' },
  { id: 'glen', label: 'GATE', min: 0.1, max: 1, def: 0.5, unit: '%' },
  ...START.map((n, i) => ({ id: `n${i}`, label: `STEP ${i + 1}`, min: -1, max: 24, def: n, stepped: true })),
  { id: 'stype', label: 'SEQUENCER', min: 0, max: SB_SEQS.length - 1, def: PATTERN, stepped: true, options: SB_SEQS },
  { id: 'arate', label: 'RATE', min: 0, max: SB_ARP_RATES.length - 1, def: 2, stepped: true, options: SB_ARP_RATES },
  { id: 'aoct', label: 'OCTAVES', min: 1, max: 3, def: 1, stepped: true },
  { id: 'amode', label: 'ARP', min: 0, max: SB_ARP_MODES.length - 1, def: 0, stepped: true, options: SB_ARP_MODES },
  { id: 'tspin', label: 'SPIN', min: -1, max: 1, def: 0.15, unit: 'Hz' },
  { id: 'tgrav', label: 'GRAVITY', min: 0.2, max: 3, def: 1, curve: 'exp', unit: 'x' },
  { id: 'tballs', label: 'BALLS', min: 1, max: SB_BALLS, def: 2, stepped: true },
  { id: 'dchange', label: 'CHANGE', min: 0, max: 1, def: 0.2, unit: '%' },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 0, stepped: true, options: ['STOP', 'PLAY'] },
  { id: 'bars', label: 'BARS', min: 1, max: 8, def: 2, stepped: true },
  { id: 'trk', label: 'TRACK', min: 0, max: SB_TRACKS - 1, def: 0, stepped: true, options: ['1', '2', '3', '4'] },
  { id: 'drive', label: 'DRIVE', min: 0, max: 1, def: 0.25, unit: '%' },
  { id: 'vol', label: 'SYNTH', min: 0, max: 1, def: 0.8, unit: '%' },
  ...[0, 1, 2, 3].map((t) => ({ id: `lv${t}`, label: `TRACK ${t + 1}`, min: 0, max: 1, def: 0.8, unit: '%' as const })),
  { id: 'master', label: 'MASTER', min: 0, max: 1, def: 0.7, unit: '%' },
]

const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'voct', label: 'V/OCT' },
  { id: 'gate', label: 'GATE' },
  { id: 'audio', label: 'AUDIO' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'clko', label: 'CLK' },
  { id: 'pitch', label: 'PITCH' },
  { id: 'gateo', label: 'GATE' },
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]

const HP = 64
const W = HP * HP_MM
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const jacks = packRows(
  [[...inputs.map((j) => jack('in', j.id)), { kind: 'knob', param: 'master', x: 0, y: 0, size: 'S' }, ...outputs.map((j) => jack('out', j.id))]],
  { params, inputs, outputs },
  W,
  { maxPitch: 30 },
)
/** The face (screen, encoders, buttons) and the keybed, above the jacks. */
const FACE = { y: 14, h: 52 }
const KEYS_Y = FACE.y + FACE.h + 2

export const sketchbook: ModuleSpec = {
  type: 'sketchbook',
  title: 'SKETCHBOOK',
  name: 'Sketchbook Workstation',
  tagline: 'A portable workstation: four-knob synth engines, a pattern sequencer, 4-track loop tape and a mixer, on a keybed',
  category: 'Systems',
  hp: HP,
  panel: SAND,
  inputs,
  outputs,
  params,
  leds: SBL.end,
  controls: [
    { kind: 'surface', name: 'sketchbook', x: 4, y: FACE.y, w: W - 8, h: FACE.h, bare: true },
    { kind: 'surface', name: 'sketchkeys', x: 4, y: KEYS_Y, w: W - 8, h: jacks.top - 1.6 - KEYS_Y, bare: true },
    ...jacks.controls,
  ],
}
