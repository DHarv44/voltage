import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { GRAPHITE } from './panels'
import {
  chainId,
  condId,
  knobId,
  LS_CHAIN,
  LOCK_PAGES,
  lockId,
  LS_ALGOS,
  LS_CONDS,
  LS_KNOBS,
  LS_MICRO,
  LS_PAGES,
  LS_PATTERNS,
  LS_RETRIGS,
  microId,
  muteId,
  noteId,
  retrigId,
  slideId,
  LS_SPEEDS,
  LS_STEPS,
  LSL,
  TRACK,
  trigsId,
  TRIG,
  withLock,
} from './lockstepDefs'
import { PATTERNS, SOUNDS, type PartDef, type SoundDef } from './lockstepFactory'

export * from './lockstepDefs'

const opt = (id: string, label: string, options: string[], def: number): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })

/** A track's sound, shared by every pattern. */
const soundParams = (d: SoundDef, t: number): ParamSpec[] => [
  ...LS_KNOBS.flat().map((label, j): ParamSpec => ({ id: knobId(t, j), label: `${d.name} ${label}`, min: 0, max: 1, def: d.knobs[j], unit: '%' })),
  opt(`algo${t}`, `T${t + 1} ALGO`, LS_ALGOS, d.algo),
  { id: `root${t}`, label: `T${t + 1} ROOT`, min: -36, max: 24, def: d.root, stepped: true, unit: 'st' },
  { id: `len${t}`, label: `T${t + 1} LENGTH`, min: 1, max: LS_STEPS, def: d.len, stepped: true },
  opt(`spd${t}`, `T${t + 1} SPEED`, LS_SPEEDS, 3),
  opt(muteId(t), `T${t + 1} MUTE`, ['ON', 'MUTE'], 0),
]

/** A track's part of pattern `pat`: its trigs and every step's data. */
const partParams = (d: PartDef, t: number, pat: number): ParamSpec[] => {
  const name = `${pat > 0 ? `${LS_PATTERNS[pat]} ` : ''}T${t + 1}`
  return [
    { id: trigsId(t, pat), label: `${name} TRIGS`, min: 0, max: 0xffff, def: Object.keys(d.trigs).reduce((m, s) => m | (1 << Number(s)), 0), stepped: true },
    ...Array.from({ length: LS_STEPS }, (_, s): ParamSpec[] => [
      { id: noteId(t, s, pat), label: `${name} STEP ${s + 1} NOTE`, min: -24, max: 24, def: d.trigs[s]?.[0] ?? 0, stepped: true, unit: 'st' },
      opt(condId(t, s, pat), `${name} STEP ${s + 1} COND`, LS_CONDS, d.trigs[s]?.[1] ?? 0),
      opt(retrigId(t, s, pat), `${name} STEP ${s + 1} RETRIG`, LS_RETRIGS, d.ratchets?.[s] ?? 0),
      { id: microId(t, s, pat), label: `${name} STEP ${s + 1} MICRO`, min: -LS_MICRO, max: LS_MICRO, def: d.nudges?.[s] ?? 0, stepped: true },
      opt(slideId(t, s, pat), `${name} STEP ${s + 1} SLIDE`, ['OFF', 'SLIDE'], d.slides?.includes(s) ? 1 : 0),
      ...Array.from({ length: LOCK_PAGES }, (_, page): ParamSpec => {
        const def = (d.locks ?? []).filter(([ls, j]) => ls === s && Math.floor(j / 4) === page).reduce((w, [, j, v]) => withLock(w, j % 4, v), 0)
        return { id: lockId(t, s, page, pat), label: `${name} STEP ${s + 1} LOCKS ${page + 1}`, min: 0, max: 0xffffffff, def, stepped: true }
      }),
    ]).flat(),
  ]
}

const params: ParamSpec[] = [
  opt('page', 'PAGE', LS_PAGES, 0),
  opt('trk', 'TRACK', ['1', '2', '3', '4'], 0),
  opt('pat', 'PATTERN', LS_PATTERNS, 0),
  // the chain: CHAIN on plays slots 1..length, a bar each (factory: A A B C)
  opt('chon', 'CHAIN', ['OFF', 'ON'], 0),
  { id: 'chlen', label: 'CHAIN LENGTH', min: 0, max: LS_CHAIN, def: 4, stepped: true },
  ...Array.from({ length: LS_CHAIN }, (_, i) => opt(chainId(i), `CHAIN ${i + 1}`, LS_PATTERNS, [0, 0, 1, 2][i] ?? 0)),
  opt('run', 'PLAY', ['STOP', 'PLAY'], 0),
  opt('fill', 'FILL', ['OFF', 'FILL'], 0),
  { id: 'tempo', label: 'TEMPO', min: 40, max: 240, def: 122, unit: 'bpm' },
  { id: 'swing', label: 'SWING', min: 0, max: 0.5, def: 0.08, unit: '%' },
  { id: 'dtime', label: 'DLY TIME', min: 0, max: 1, def: 0.45, unit: '%' },
  { id: 'dfb', label: 'DLY FDBK', min: 0, max: 1, def: 0.45, unit: '%' },
  { id: 'master', label: 'MASTER', min: 0, max: 1, def: 0.8, unit: '%' },
  ...SOUNDS.flatMap(soundParams),
  ...PATTERNS.flatMap((parts, pat) => parts.flatMap((d, t) => partParams(d, t, pat))),
]

/** The four encoders' params (null = unused): the selected track's page, the
 *  selected step's NOTE / COND on TRIG (in the pattern on show), global
 *  tempo and delay on TEMPO. */
export function encoderParams(p: Record<string, number>, sel: number): (string | null)[] {
  const page = Math.round(p.page ?? 0)
  const t = Math.round(p.trk ?? 0)
  const pat = Math.round(p.pat ?? 0)
  if (page < LOCK_PAGES) return [0, 1, 2, 3].map((i) => knobId(t, page * 4 + i))
  if (page === TRIG) return sel >= 0 ? [noteId(t, sel, pat), condId(t, sel, pat), retrigId(t, sel, pat), microId(t, sel, pat)] : [null, null, null, null]
  if (page === TRACK) return [`algo${t}`, `root${t}`, `len${t}`, `spd${t}`]
  return ['tempo', 'swing', 'dtime', 'dfb']
}

export function encoderLabels(p: Record<string, number>): string[] {
  const page = Math.round(p.page ?? 0)
  if (page < LOCK_PAGES) return LS_KNOBS[page]
  if (page === TRIG) return ['NOTE', 'COND', 'RETRIG', 'MICRO']
  if (page === TRACK) return ['ALGO', 'ROOT', 'LENGTH', 'SPEED']
  return ['TEMPO', 'SWING', 'DLY TIME', 'DLY FDBK']
}

const inputs: ModuleSpec['inputs'] = [
  { id: 'clk', label: 'CLK' },
  { id: 'run', label: 'RUN' },
  { id: 'fill', label: 'FILL' },
  { id: 'reset', label: 'RESET' },
  { id: 'pat', label: 'PAT' },
]
/** T1–T4: each track's voice on its own (after LEVEL, before PAN and delay). */
const outputs: ModuleSpec['outputs'] = [
  { id: 'clko', label: 'CLK' },
  { id: 'rsto', label: 'RST' },
  ...[1, 2, 3, 4].map((i) => ({ id: `t${i}`, label: `T${i}` })),
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
]

const HP = 56
const W = HP * HP_MM
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const jacks = packRows(
  [[...inputs.map((j) => jack('in', j.id)), { kind: 'knob', param: 'master', x: 0, y: 0, size: 'S' }, ...outputs.map((j) => jack('out', j.id))]],
  { params, inputs, outputs },
  W,
  { maxPitch: 30 },
)
const FACE_Y = 14

/** LOCKSTEP: an FM groovebox in the Elektron tradition (our own design).
 *  Four tracks, each an FM voice (three operators, six algorithms, eight
 *  ratio sets) through a filter; sixteen steps per track with its own length
 *  and speed; every step can lock any of the twelve sound knobs (a
 *  parameter lock), carry its own note, and a condition (1:2, 50%, FILL…).
 *  Four patterns A–D share the sounds; a new one cues for the end of the bar;
 *  a CHAIN plays up to eight in turn; PAT in picks one by voltage. */
export const lockstep: ModuleSpec = {
  type: 'lockstep',
  title: 'LOCKSTEP',
  name: 'LOCKSTEP FM Groovebox',
  tagline: 'Four FM tracks, sixteen steps each with parameter locks and conditional trigs; polymeter by track; patterns A–D',
  category: 'Systems',
  hp: HP,
  panel: GRAPHITE,
  inputs,
  outputs,
  params,
  leds: LSL.end,
  controls: [{ kind: 'surface', name: 'lockstep', x: 4, y: FACE_Y, w: W - 8, h: jacks.top - 1.6 - FACE_Y, bare: true }, ...jacks.controls],
}
