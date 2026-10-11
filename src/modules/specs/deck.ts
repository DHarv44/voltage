import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'
import { BLACK } from './panels'
import { SOUND_NAMES } from './sampling'

export const DK_TRACKS = 4
/** A track's sound: a factory sample, or OWN (its pickup recording or loaded file). */
export const DK_SOUNDS = [...SOUND_NAMES, 'OWN']
export const DK_OWN = SOUND_NAMES.length
/** SLICE: step n plays the sound from its nth sixteenth (a loop stays in
 *  time, cut up by the trigs). HIT: every trig plays it from the top. */
export const DK_MODES = ['SLICE', 'HIT']
export const DK_STEPS = 16
/** A scene's settings per track: low-pass cutoff (0..1), pitch (semitones),
 *  level (0..1), crush (0..1). */
export const DK_FIELDS = ['cut', 'pit', 'lvl', 'crs'] as const
export const DK_FIELD_NAMES = ['CUTOFF', 'PITCH', 'LEVEL', 'CRUSH']
export const dkId = (scene: 'a' | 'b', t: number, f: (typeof DK_FIELDS)[number]) => `${scene}${t}${f}`
/** LEDs: the step (−1 stopped), the track being recorded (−1), armed (0
 *  off, 0.5 waiting for the bar, 1 recording), each track's level (0..1),
 *  then whether each track has an OWN sound (0/1). */
export const DKL = { step: 0, rec: 1, armed: 2, level0: 3, own0: 3 + DK_TRACKS } as const

/** Factory trigs: the break on every step, the choir once a bar, the
 *  orchestra hit on the offbeats of the second half. */
const TRIGS = [0xffff, 0x0001, 0x2200, 0]
const SOUNDS = [7, 1, 0, DK_OWN]
const MODES = [0, 1, 1, 0]
/** Factory scenes: A the plain mix, B a filtered, crushed, pitched-down breakdown. */
const SCENE_A: Record<(typeof DK_FIELDS)[number], number> = { cut: 1, pit: 0, lvl: 0.8, crs: 0 }
const SCENE_B: Record<(typeof DK_FIELDS)[number], number>[] = [
  { cut: 0.35, pit: -5, lvl: 0.8, crs: 0.6 },
  { cut: 0.9, pit: 0, lvl: 1, crs: 0 },
  { cut: 0.5, pit: -12, lvl: 0.4, crs: 0.4 },
  { cut: 1, pit: 0, lvl: 0.8, crs: 0 },
]

const knob = (param: string, size: 'S' | 'L' = 'S'): Control => ({ kind: 'knob', param, x: 0, y: 0, size })
const jack = (kind: 'in' | 'out', id: string): Control => ({ kind, jack: id, x: 0, y: 0 })
const range: Record<(typeof DK_FIELDS)[number], [number, number]> = { cut: [0, 1], pit: [-12, 12], lvl: [0, 1], crs: [0, 1] }

const params: ParamSpec[] = [
  { id: 'xf', label: 'CROSSFADER', min: 0, max: 1, def: 0, unit: '%' },
  { id: 'tempo', label: 'TEMPO', min: 60, max: 200, def: 112, unit: 'bpm' },
  { id: 'level', label: 'LEVEL', min: 0, max: 1, def: 0.8, unit: '%' },
  { id: 'rectrk', label: 'REC TRACK', min: 0, max: DK_TRACKS - 1, def: 3, stepped: true, options: ['1', '2', '3', '4'] },
  { id: 'run', label: 'PLAY', min: 0, max: 1, def: 1, stepped: true, options: ['STOP', 'PLAY'] },
  ...Array.from({ length: DK_TRACKS }, (_, t): ParamSpec[] => [
    { id: `m${t}`, label: `TRACK ${t + 1} TRIGS`, min: 0, max: 0xffff, def: TRIGS[t], stepped: true },
    { id: `snd${t}`, label: `TRACK ${t + 1} SOUND`, min: 0, max: DK_OWN, def: SOUNDS[t], stepped: true, options: DK_SOUNDS },
    { id: `pm${t}`, label: `TRACK ${t + 1} PLAY`, min: 0, max: 1, def: MODES[t], stepped: true, options: DK_MODES },
  ]).flat(),
  ...(['a', 'b'] as const).flatMap((s) =>
    Array.from({ length: DK_TRACKS }, (_, t) =>
      DK_FIELDS.map((f, i): ParamSpec => ({
        id: dkId(s, t, f),
        label: `SCENE ${s.toUpperCase()} TRACK ${t + 1} ${DK_FIELD_NAMES[i]}`,
        min: range[f][0],
        max: range[f][1],
        def: s === 'a' ? SCENE_A[f] : SCENE_B[t][f],
        stepped: f === 'pit',
      })),
    ).flat(),
  ),
]
const inputs: ModuleSpec['inputs'] = [
  { id: 'in', label: 'IN' },
  { id: 'clk', label: 'CLK' },
  { id: 'rst', label: 'RST' },
  { id: 'xfcv', label: 'XFADE' },
  { id: 'rec', label: 'REC' },
]
const outputs: ModuleSpec['outputs'] = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
  ...Array.from({ length: DK_TRACKS }, (_, t) => ({ id: `t${t + 1}`, label: `T${t + 1}` })),
]

const HP = 44
const W = HP * HP_MM
const layout = packRows(
  [
    [knob('xf', 'L'), knob('tempo'), knob('level'), knob('rectrk'), { kind: 'switch', param: 'run', x: 0, y: 0 }, { kind: 'button', name: 'rec', x: 0, y: 0, label: 'REC', led: DKL.armed, ledColor: '#ff3b2f' }, ...Array.from({ length: DK_TRACKS }, (_, t): Control => ({ kind: 'file', slot: t, x: 0, y: 0, label: `LOAD ${t + 1}` }))],
    [jack('in', 'in'), jack('in', 'clk'), jack('in', 'rst'), jack('in', 'xfcv'), jack('in', 'rec'), jack('out', 't1'), jack('out', 't2'), jack('out', 't3'), jack('out', 't4'), jack('out', 'l'), jack('out', 'r')],
  ],
  { params, inputs, outputs },
  W,
  { gap: 1.6 },
)

/** DECK: a performance sampler (our own take on the big live-sampling
 *  boxes): four tracks, each a sample sliced across sixteen steps and played
 *  by its trigs; every track has two SCENES (its cutoff, pitch, level and
 *  crush in each), and the CROSSFADER morphs the whole deck from scene A to
 *  scene B: the breakdown, the build, the drop, all on one fader. Pickup
 *  recording: pick a track, press REC, and the next whole bar of IN (in time
 *  with the clock) becomes its OWN loop, sliced and played straight away.
 *  LOAD puts a file on a track as its OWN sound. */
export const deck: ModuleSpec = {
  type: 'deck',
  title: 'DECK',
  name: 'Deck (Performance Sampler)',
  tagline: 'Four sliced sample tracks with step trigs, two scenes each (cutoff, pitch, level, crush) morphed by one crossfader; pickup recording in time',
  category: 'Sampling & Tape',
  hp: HP,
  panel: BLACK,
  inputs,
  outputs,
  params,
  leds: DKL.own0 + DK_TRACKS,
  controls: [{ kind: 'surface', name: 'deck', x: 4, y: 14, w: W - 8, h: layout.top - BEZEL - 1.5 - 14 } as Control, ...layout.controls],
}
