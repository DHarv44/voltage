import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec } from '../types'
import { BLACK } from './panels'

/** Scenes the VISION tank can hold, in SCENE knob order. */
export const VISION_SCENES = ['JELLY', 'GARDEN', 'FIREFLIES', 'AURORA', 'CYMATICS'] as const

/** Per-scene extra state starts here on the LED channel (after the shared VS fields). */
export const VS_EXTRA = 10
/** Every scene lives at once. The LED channel is blocks of LED_BLOCK values:
 *  block 0 mirrors the selected scene, block k + 1 is scene k (so a VISION VIEW
 *  can watch any scene, whatever the tank's SCENE knob drives). */
export const LED_BLOCK = 64
export const sceneBlock = (scene: number) => (scene + 1) * LED_BLOCK
/** Garden: up to this many plants (COUNT picks how many live), and the values
 *  each one publishes (x, growth, open, wilt, visibility). */
export const GARDEN_PLANTS = 10
export const PLANT_VALUES = 5
/** Jelly: depth in the tank (0 back wall … 1 front glass) and the bell's
 *  lean toward/away from the glass (radians). */
export const JELLY_Z = VS_EXTRA
export const JELLY_PITCH = VS_EXTRA + 1
/** Cymatics: mode m, n, index, a knock's decaying jolt, the plate's tilt. */
export const CYM = { m: VS_EXTRA, n: VS_EXTRA + 1, mode: VS_EXTRA + 2, knock: VS_EXTRA + 3, tilt: VS_EXTRA + 4 } as const
/** Fireflies: up to this many (COUNT picks how many fly), each publishing its
 *  brightness (−1 = not flying). */
export const FIREFLIES = 48

/** COUNT (0..1, default ½ = each scene's classic look) → how many of each
 *  scene's things there are. Shared by the engine and the renderer. */
export const countOf = {
  /** Jellies: one up to halfway, then up to six (a smack). */
  jellies: (c: number) => (c <= 0.5 ? 1 : 1 + Math.round((c - 0.5) * 10)),
  /** Marine snow: thins out below halfway. */
  snow: (c: number) => Math.round(220 * Math.min(1, 0.15 + c * 1.7)),
  plants: (c: number) => Math.max(1, Math.min(GARDEN_PLANTS, Math.round(c * 10))),
  fireflies: (c: number) => Math.max(4, Math.min(FIREFLIES, Math.round(c * 48))),
  curtains: (c: number) => Math.max(1, Math.min(6, Math.round(c * 6))),
  grains: (c: number) => Math.max(300, Math.round(c * 5000)),
}

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
  /** How many things the scene has (see countOf); halfway = its classic look. */
  { id: 'count', label: 'COUNT', min: 0, max: 1, def: 0.5, unit: '%' },
]

/** Widths (HP) the screen modules come in: right-click → Size. */
export const SCREEN_SIZES = [12, 20, 28, 40]

/** The glass starts here (just under the top screws) and stops this far above
 *  the controls (its bezel plus a hair). */
export const GLASS_TOP = 5.5
export const GLASS_GAP = BEZEL + 0.6
/** Closest two control centres may sit across a row (a small knob's ring). */
const PITCH = 11.5

/** VISION's controls, in reading order: knobs, then inputs, then outputs. */
const VISION_CONTROLS: Control[] = [
  ...(['scene', 'rate', 'hue', 'glow', 'count'] as const).map((param): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })),
  ...(['trig', 'feed', 'glow', 'hue', 'move'] as const).map((jack): Control => ({ kind: 'in', jack, x: 0, y: 0 })),
  ...(['gate', 'sway', 'grow', 'light', 'link'] as const).map((jack): Control => ({ kind: 'out', jack, x: 0, y: 0 })),
]

/** Split controls into as few even rows as fit across `w` mm. */
export function rowsThatFit<T>(items: T[], w: number, pitch = PITCH): T[][] {
  const fit = Math.max(1, Math.floor((w - 12) / pitch) + 1)
  const rows = Math.ceil(items.length / fit)
  const per = Math.ceil(items.length / rows)
  return Array.from({ length: rows }, (_, r) => items.slice(r * per, (r + 1) * per))
}

/** VISION's panel at any width. The glass is the point: the controls pack into
 *  as few rows as the width allows (packRows keeps their labels and plates
 *  clear of each other) and the glass takes everything above, edge to edge.
 *  The gate LED sits on the top edge between the screws. */
function visionLayout(hp: number): Control[] {
  const w = hp * HP_MM
  const spec = { params: VISION_PARAMS, inputs: VISION_INPUTS, outputs: VISION_OUTPUTS }
  const { controls, top } = packRows(rowsThatFit(VISION_CONTROLS, w), spec, w)
  return [
    { kind: 'vision', x: 2.5, y: GLASS_TOP, w: w - 5, h: top - GLASS_GAP - GLASS_TOP },
    { kind: 'led', index: VS.gate, x: w / 2, y: 2.9, color: '#5ef2ff' },
    ...controls,
  ]
}

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
  controls: visionLayout(20),
  sizes: SCREEN_SIZES,
  layout: visionLayout,
}
