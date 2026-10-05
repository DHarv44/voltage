import type { ModuleSpec } from '../types'
import { BLACK } from './panels'

/** Scenes the VISION tank can hold, in SCENE knob order. */
export const VISION_SCENES = ['JELLY', 'GARDEN', 'FIREFLIES', 'AURORA', 'CYMATICS'] as const

/** Per-scene extra state starts here on the LED channel (after the shared VS fields). */
export const VS_EXTRA = 10
/** Every scene lives at once. The LED channel is blocks of LED_BLOCK values:
 *  block 0 mirrors the selected scene, block k + 1 is scene k (so a VISION VIEW
 *  can watch any scene, whatever the tank's SCENE knob drives). */
export const LED_BLOCK = 40
export const sceneBlock = (scene: number) => (scene + 1) * LED_BLOCK
/** Garden: plants and the values each one publishes (x, growth, open, wilt, visibility). */
export const GARDEN_PLANTS = 5
export const PLANT_VALUES = 5
/** Jelly: depth in the tank (0 back wall … 1 front glass) and the bell's
 *  lean toward/away from the glass (radians). */
export const JELLY_Z = VS_EXTRA
export const JELLY_PITCH = VS_EXTRA + 1
/** Cymatics: mode m, n, index, a knock's decaying jolt, the plate's tilt. */
export const CYM = { m: VS_EXTRA, n: VS_EXTRA + 1, mode: VS_EXTRA + 2, knock: VS_EXTRA + 3, tilt: VS_EXTRA + 4 } as const
/** Fireflies: how many, each publishing its brightness. */
export const FIREFLIES = 24

/** Creature state the engine publishes on the LED channel (~30 Hz); the renderer
 *  reads these, so both sides agree on the layout. */
export const VS = {
  /** Jelly: bell contraction 0..1. Flower: petal opening 0..1. */
  action: 0,
  x: 1,
  y: 2,
  tilt: 3,
  /** Bioluminescence 0..~1.5. */
  glow: 4,
  /** Colour 0..1 around the wheel. */
  hue: 5,
  /** Jelly size / flower growth 0..1. */
  grow: 6,
  /** Tentacle trail / stem sway −1..1. */
  sway: 7,
  /** Flower wilt 0..1. */
  wilt: 8,
  /** Panel LED: the GATE output. */
  gate: 9,
} as const

/** Flower growth stages (fraction of full growth): four leaves, the bud, the bloom. */
export const FLOWER_STAGES = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]

const COLS = [12, 31.5, 51, 70.5, 90]

export const VISION_LEDS = LED_BLOCK * (1 + VISION_SCENES.length)

/** Shared by VISION and VISION CORE (the same creature engine). The names are
 *  generic; each scene reads them its own way:
 *
 *  | jack   | JELLY        | GARDEN          | FIREFLIES      | AURORA        | CYMATICS            |
 *  | TRIG   | bell stroke  | pollen burst    | scatter        | substorm      | knock the plate     |
 *  | FEED   | food → size  | food → health   | coupling       | solar wind    | drive               |
 *  | PITCH  | colour/note  | colour/note     | colour/note    | colour/note   | mode + colour       |
 *  | MOVE   | current      | wind            | drift          | curtains      | tilt                |
 *  | GATE   | stroke       | each new stage  | meadow flash   | onset         | new mode / knock    |
 *  | MOTION | tentacles    | stems           | drift          | curtains      | buzz                |
 *  | STATE  | size         | how alive       | sync           | energy        | mode number         |
 *
 *  Jack ids stay as first named (hue, sway, grow) so saved patches keep their
 *  cables. LINK carries no voltage: patch it into VISION VIEW modules. */
export const VISION_INPUTS: ModuleSpec['inputs'] = [
  { id: 'trig', label: 'TRIG' },
  { id: 'feed', label: 'FEED' },
  { id: 'glow', label: 'GLOW' },
  { id: 'hue', label: 'PITCH' },
  { id: 'move', label: 'MOVE' },
]
export const VISION_OUTPUTS: ModuleSpec['outputs'] = [
  { id: 'gate', label: 'GATE' },
  { id: 'sway', label: 'MOTION' },
  { id: 'grow', label: 'STATE' },
  { id: 'light', label: 'LIGHT' },
  { id: 'link', label: 'LINK' },
]
export const VISION_PARAMS: ModuleSpec['params'] = [
  { id: 'scene', label: 'SCENE', min: 0, max: VISION_SCENES.length - 1, def: 0, stepped: true, options: [...VISION_SCENES] },
  { id: 'rate', label: 'RATE', min: 0.05, max: 2, def: 0.4, curve: 'exp', unit: 'Hz' },
  { id: 'hue', label: 'HUE', min: 0, max: 1, def: 0.55, unit: '%' },
  { id: 'glow', label: 'GLOW', min: 0, max: 1, def: 0.7, unit: '%' },
]

/** A glass tank with a living creature in it. The creature's body runs on the
 *  engine clock, so it is patched like any module: CV steers it, and its
 *  movements come back out as gates and voltages. */
export const vision: ModuleSpec = {
  type: 'vision',
  title: 'VISION',
  name: 'Vision Tank',
  tagline: 'Living scenes you patch: jellyfish, a flower garden, fireflies, aurora, cymatics. CV in, CV out',
  category: 'Visuals',
  hp: 20,
  panel: BLACK,
  inputs: VISION_INPUTS,
  outputs: VISION_OUTPUTS,
  params: VISION_PARAMS,
  leds: VISION_LEDS,
  controls: [
    { kind: 'vision', x: 5, y: 16, w: 91.6, h: 56 },
    { kind: 'knob', param: 'scene', x: COLS[0], y: 80, size: 'S' },
    { kind: 'knob', param: 'rate', x: COLS[1], y: 80, size: 'S' },
    { kind: 'knob', param: 'hue', x: COLS[2], y: 80, size: 'S' },
    { kind: 'knob', param: 'glow', x: COLS[3], y: 80, size: 'S' },
    { kind: 'led', index: VS.gate, x: COLS[4], y: 80, color: '#5ef2ff' },
    { kind: 'in', jack: 'trig', x: COLS[0], y: 97 },
    { kind: 'in', jack: 'feed', x: COLS[1], y: 97 },
    { kind: 'in', jack: 'glow', x: COLS[2], y: 97 },
    { kind: 'in', jack: 'hue', x: COLS[3], y: 97 },
    { kind: 'in', jack: 'move', x: COLS[4], y: 97 },
    { kind: 'out', jack: 'gate', x: COLS[0], y: 113.5 },
    { kind: 'out', jack: 'sway', x: COLS[1], y: 113.5 },
    { kind: 'out', jack: 'grow', x: COLS[2], y: 113.5 },
    { kind: 'out', jack: 'light', x: COLS[3], y: 113.5 },
    { kind: 'out', jack: 'link', x: COLS[4], y: 113.5 },
  ],
}
