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

/** `n` evenly spaced columns centred on a panel `w` mm wide (at most `gap` apart). */
export const columns = (w: number, n: number, gap: number) => {
  const s = Math.min(gap, (w - 12) / (n - 1))
  return Array.from({ length: n }, (_, i) => w / 2 + (i - (n - 1) / 2) * s)
}

/** Smallest comfortable spacing between control centres (mm), and the gap
 *  between rows: a knob's label below and a jack's label above clear each other. */
const PITCH = 11.5
const ROW = 17
/** Centre of the lowest control row, and the clearance above the top row. */
const BOTTOM_ROW = 117.5
const ABOVE = 10

/** VISION's controls, in reading order: knobs, then inputs, then outputs. */
const VISION_CONTROLS: Control[] = [
  ...(['scene', 'rate', 'hue', 'glow', 'count'] as const).map((param): Control => ({ kind: 'knob', param, x: 0, y: 0, size: 'S' })),
  ...(['trig', 'feed', 'glow', 'hue', 'move'] as const).map((jack): Control => ({ kind: 'in', jack, x: 0, y: 0 })),
  ...(['gate', 'sway', 'grow', 'light', 'link'] as const).map((jack): Control => ({ kind: 'out', jack, x: 0, y: 0 })),
]

/** VISION's panel at any width. The glass is the point, so the controls are
 *  packed into as few rows as the width allows (one row at 40 HP, two at
 *  20–28, three at 12) and the glass takes everything above them, edge to
 *  edge. The gate LED sits on the top edge between the screws. */
function visionLayout(hp: number): Control[] {
  const w = hp * HP_MM
  const fit = Math.max(1, Math.floor((w - 8) / PITCH) + 1)
  const rows = Math.ceil(VISION_CONTROLS.length / fit)
  const perRow = Math.ceil(VISION_CONTROLS.length / rows)
  // three narrow rows are one kind each (knobs / ins / outs): they can sit closer
  const gap = rows >= 3 ? 15.5 : ROW
  const top = BOTTOM_ROW - (rows - 1) * gap
  const out: Control[] = [
    { kind: 'vision', x: 2.5, y: 5.5, w: w - 5, h: top - ABOVE - 5.5 },
    { kind: 'led', index: VS.gate, x: w / 2, y: 2.9, color: '#5ef2ff' },
  ]
  for (let r = 0; r < rows; r++) {
    const row = VISION_CONTROLS.slice(r * perRow, (r + 1) * perRow)
    const xs = columns(w, Math.max(2, row.length), 16)
    row.forEach((c, i) => out.push({ ...c, x: row.length === 1 ? w / 2 : xs[i], y: top + r * gap } as Control))
  }
  return out
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
