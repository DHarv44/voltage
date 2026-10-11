import type { Control, ModuleSpec, ParamSpec } from '../types'
import { opts, simpleSpec } from './build'
import { BLACK } from './panels'

export const CL_TRACKS = 4
export const CL_SCENES = 4
export const CL_STEPS = 16
/** A step's note: −1 rests, 0–24 semitones above the track's octave, TIE holds the note before. */
export const clStep = (t: number, c: number, s: number) => `n${t}${c}_${s}`
export const CL_TIE = 25
/** LEDs: per track the clip playing (−1), the clip cued (−1); then the step. */
export const CLL = { playing: 0, cued: CL_TRACKS, step: CL_TRACKS * 2 } as const
/** Surface events: x = track × 4 + clip (or the scene), y = what. */
export const CL_LAUNCH = 0
export const CL_STOP = 1
export const CL_SCENE = 2

/** Factory clips: drums-free parts in A minor, a scene per section. */
const FACTORY: number[][][] = [
  // track 1: bass (octave −2)
  [
    [0, -1, 0, -1, 0, -1, 0, 3, 5, -1, 5, -1, 3, -1, 2, -1],
    [0, 0, 12, 0, 0, 12, 0, 12, 5, 5, 17, 5, 3, 3, 15, 3],
    [0, 25, 25, 25, 25, 25, 25, 25, 5, 25, 25, 25, 7, 25, 25, 25],
    [],
  ],
  // track 2: chords' roots, held (octave −1)
  [
    [12, 25, 25, 25, 25, 25, 25, 25, 8, 25, 25, 25, 10, 25, 25, 25],
    [12, -1, 15, -1, 19, -1, 15, -1, 8, -1, 12, -1, 10, -1, 14, -1],
    [],
    [],
  ],
  // track 3: lead (octave 0)
  [
    [12, -1, 15, 17, -1, 19, -1, 17, 15, -1, 12, -1, 10, -1, 12, -1],
    [24, 22, 19, 17, 19, -1, 15, 17, 12, -1, -1, -1, 15, 14, 12, 10],
    [],
    [],
  ],
  // track 4: arpeggio (octave 0)
  [
    [0, 3, 7, 12, 0, 3, 7, 12, 0, 3, 7, 12, 0, 3, 7, 12],
    [],
    [0, 7, 12, 15, 19, 15, 12, 7, 0, 7, 12, 15, 19, 15, 12, 7],
    [],
  ],
]
const OCT = [-2, -1, 0, 0]

const params: ParamSpec[] = [
  { id: 'tempo', label: 'TEMPO', min: 60, max: 200, def: 118, unit: 'bpm' },
  opts('run', 'PLAY', ['STOP', 'PLAY'], 1),
  { id: 'gl', label: 'GATE', min: 0.1, max: 1, def: 0.5, unit: '%' },
  ...Array.from({ length: CL_TRACKS }, (_, t): ParamSpec[] => [
    { id: `oct${t}`, label: `TRACK ${t + 1} OCTAVE`, min: -3, max: 3, def: OCT[t], stepped: true },
    { id: `pl${t}`, label: `TRACK ${t + 1} PLAYING`, min: -1, max: CL_SCENES - 1, def: t === 2 ? -1 : 0, stepped: true },
    ...Array.from({ length: CL_SCENES * CL_STEPS }, (_, k): ParamSpec => {
      const c = Math.floor(k / CL_STEPS)
      const s = k % CL_STEPS
      return { id: clStep(t, c, s), label: `TRACK ${t + 1} CLIP ${c + 1} STEP ${s + 1}`, min: -1, max: CL_TIE, def: FACTORY[t][c][s] ?? -1, stepped: true }
    }),
  ]).flat(),
]

/** CLIPS: the session view of a DAW in a module. */
export const clips: ModuleSpec = simpleSpec({
  type: 'clips',
  title: 'CLIPS',
  name: 'Clip Launcher',
  tagline: 'Four tracks × four scenes of one-bar clips, launched (one by one or a whole scene) in time on the next bar; draw notes on the screen',
  category: 'Sequencers',
  hp: 40,
  panel: BLACK,
  params,
  inputs: [
    { id: 'clk', label: 'CLK' },
    { id: 'rst', label: 'RST' },
    { id: 'scv', label: 'SCENE CV' },
  ],
  outputs: Array.from({ length: CL_TRACKS }, (_, t) => [
    { id: `p${t + 1}`, label: `PITCH ${t + 1}` },
    { id: `g${t + 1}`, label: `GATE ${t + 1}` },
  ]).flat(),
  leds: CLL.step + 1,
  rows: [
    ['ks:tempo', 's:run', 'ks:gl', 'i:clk', 'i:rst', 'i:scv'],
    ['o:p1', 'o:g1', 'o:p2', 'o:g2', 'o:p3', 'o:g3', 'o:p4', 'o:g4'],
  ],
  top: (top, w) => [{ kind: 'surface', name: 'clips', x: 4, y: 14, w: w - 8, h: top - 15.5 - 14 } as Control],
})
