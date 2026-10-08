import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { GRAPHITE } from './panels'
import {
  knobId,
  LOCK_PAGES,
  lockId,
  LS_ALGOS,
  LS_CONDS,
  LS_KNOBS,
  LS_MICRO,
  LS_PAGES,
  LS_RETRIGS,
  microId,
  muteId,
  retrigId,
  LS_SPEEDS,
  LS_STEPS,
  LS_TRACKS,
  LSL,
  TRACK,
  TRIG,
  withLock,
} from './lockstepDefs'

export * from './lockstepDefs'

/** A track to start from: its twelve knobs, setup, trigs (step → note, cond). */
interface TrackDef {
  name: string
  knobs: number[]
  algo: number
  root: number
  len: number
  trigs: Record<number, [note: number, cond?: number]>
  /** Steps with a lock: [step, knob 0..11, value]. */
  locks?: [number, number, number][]
  /** Ratchets (step → 1..3 extra hits) and micro-timing (step → 24ths of a step). */
  ratchets?: Record<number, number>
  nudges?: Record<number, number>
}
const TRACKS: TrackDef[] = [
  { name: 'KICK', knobs: [0, 0.15, 0, 0.05, 0, 0.35, 0.6, 0.9, 0.4, 0, 0.5, 0], algo: 1, root: -24, len: 16, trigs: { 0: [0], 4: [0], 8: [0], 12: [0], 14: [0, 13] } },
  {
    name: 'BASS',
    knobs: [0.19, 0.35, 0.15, 0.3, 0, 0.3, 0, 0.75, 0.5, 0.35, 0.5, 0],
    algo: 1,
    root: -24,
    len: 16,
    trigs: { 2: [0], 3: [12], 6: [0], 10: [3], 11: [5, 11], 14: [7, 1] },
    nudges: { 3: 5, 11: 4 }, // the octave and the fourth land a touch late: a lazier bass
  },
  {
    name: 'HATS',
    knobs: [0.56, 0.9, 0.85, 0.1, 0, 0.05, 0, 0.35, 0.95, 0, 0.65, 0],
    algo: 1,
    root: 24,
    len: 16,
    trigs: { 2: [0], 6: [0], 10: [0], 14: [0], 15: [0, 12] },
    locks: [[14, 5, 0.42]], // an open hat: step 15's DECAY locked longer
    ratchets: { 15: 2 }, // the last hat a quick triple roll
  },
  { name: 'BELL', knobs: [0.94, 0.45, 0, 0.25, 0, 0.45, 0, 0.5, 0.8, 0.1, 0.35, 0.4], algo: 0, root: 0, len: 12, trigs: { 2: [7], 7: [10, 11], 10: [3] } },
]

const opt = (id: string, label: string, options: string[], def: number): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })

const trackParams = (d: TrackDef, t: number): ParamSpec[] => [
  ...LS_KNOBS.flat().map((label, j): ParamSpec => ({ id: knobId(t, j), label: `${d.name} ${label}`, min: 0, max: 1, def: d.knobs[j], unit: '%' })),
  opt(`algo${t}`, `T${t + 1} ALGO`, LS_ALGOS, d.algo),
  { id: `root${t}`, label: `T${t + 1} ROOT`, min: -36, max: 24, def: d.root, stepped: true, unit: 'st' },
  { id: `len${t}`, label: `T${t + 1} LENGTH`, min: 1, max: LS_STEPS, def: d.len, stepped: true },
  opt(`spd${t}`, `T${t + 1} SPEED`, LS_SPEEDS, 3),
  { id: `tr${t}`, label: `T${t + 1} TRIGS`, min: 0, max: 0xffff, def: Object.keys(d.trigs).reduce((m, s) => m | (1 << Number(s)), 0), stepped: true },
  opt(muteId(t), `T${t + 1} MUTE`, ['ON', 'MUTE'], 0),
  ...Array.from({ length: LS_STEPS }, (_, s): ParamSpec[] => [
    { id: `n${t}_${s}`, label: `T${t + 1} STEP ${s + 1} NOTE`, min: -24, max: 24, def: d.trigs[s]?.[0] ?? 0, stepped: true, unit: 'st' },
    opt(`c${t}_${s}`, `T${t + 1} STEP ${s + 1} COND`, LS_CONDS, d.trigs[s]?.[1] ?? 0),
    opt(retrigId(t, s), `T${t + 1} STEP ${s + 1} RETRIG`, LS_RETRIGS, d.ratchets?.[s] ?? 0),
    { id: microId(t, s), label: `T${t + 1} STEP ${s + 1} MICRO`, min: -LS_MICRO, max: LS_MICRO, def: d.nudges?.[s] ?? 0, stepped: true },
    ...Array.from({ length: LOCK_PAGES }, (_, page): ParamSpec => {
      const def = (d.locks ?? []).filter(([ls, j]) => ls === s && Math.floor(j / 4) === page).reduce((w, [, j, v]) => withLock(w, j % 4, v), 0)
      return { id: lockId(t, s, page), label: `T${t + 1} STEP ${s + 1} LOCKS ${page + 1}`, min: 0, max: 0xffffffff, def, stepped: true }
    }),
  ]).flat(),
]

const params: ParamSpec[] = [
  opt('page', 'PAGE', LS_PAGES, 0),
  opt('trk', 'TRACK', ['1', '2', '3', '4'], 0),
  opt('run', 'PLAY', ['STOP', 'PLAY'], 0),
  opt('fill', 'FILL', ['OFF', 'FILL'], 0),
  { id: 'tempo', label: 'TEMPO', min: 40, max: 240, def: 122, unit: 'bpm' },
  { id: 'swing', label: 'SWING', min: 0, max: 0.5, def: 0.08, unit: '%' },
  { id: 'dtime', label: 'DLY TIME', min: 0, max: 1, def: 0.45, unit: '%' },
  { id: 'dfb', label: 'DLY FDBK', min: 0, max: 1, def: 0.45, unit: '%' },
  { id: 'master', label: 'MASTER', min: 0, max: 1, def: 0.8, unit: '%' },
  ...TRACKS.flatMap(trackParams),
]

/** The four encoders' params (null = unused): the selected track's page, the
 *  selected step's NOTE / COND on TRIG, global tempo and delay on TEMPO. */
export function encoderParams(p: Record<string, number>, sel: number): (string | null)[] {
  const page = Math.round(p.page ?? 0)
  const t = Math.round(p.trk ?? 0)
  if (page < LOCK_PAGES) return [0, 1, 2, 3].map((i) => knobId(t, page * 4 + i))
  if (page === TRIG) return sel >= 0 ? [`n${t}_${sel}`, `c${t}_${sel}`, retrigId(t, sel), microId(t, sel)] : [null, null, null, null]
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
 *  parameter lock), carry its own note, and a condition (1:2, 50%, FILL…). */
export const lockstep: ModuleSpec = {
  type: 'lockstep',
  title: 'LOCKSTEP',
  name: 'LOCKSTEP FM Groovebox',
  tagline: 'Four FM tracks, sixteen steps each with parameter locks and conditional trigs; polymeter by track',
  category: 'Systems',
  hp: HP,
  panel: GRAPHITE,
  inputs,
  outputs,
  params,
  leds: LSL.end,
  controls: [{ kind: 'surface', name: 'lockstep', x: 4, y: FACE_Y, w: W - 8, h: jacks.top - 1.6 - FACE_Y, bare: true }, ...jacks.controls],
}
