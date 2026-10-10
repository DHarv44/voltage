import { BEZEL, packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec } from '../types'
import { BLACK } from './panels'
import { BUG_OPTIONS, FLORA_OPTIONS, GARDEN_PLANTS, SKY_OPTIONS, TREE_OPTIONS } from './garden'
import { LED_BLOCK, VS, VS_EXTRA } from './visionState'

export { LED_BLOCK, sceneBlock, VS, VS_EXTRA } from './visionState'

/** Scenes the VISION tank can hold, in SCENE knob order. */
export const VISION_SCENES = ['JELLY', 'GARDEN', 'FIREFLIES', 'AURORA', 'CYMATICS', 'MURMURATION', 'RAIN', 'REEF'] as const

/** Jelly: depth in the tank (0 back wall … 1 front glass) and the bell's
 *  lean toward/away from the glass (radians). */
export const JELLY_Z = VS_EXTRA
export const JELLY_PITCH = VS_EXTRA + 1
/** Cymatics: mode m, n, index, a knock's decaying jolt, the plate's tilt
 *  across and up (−1..1: the sand slides that way). */
export const CYM = { m: VS_EXTRA, n: VS_EXTRA + 1, mode: VS_EXTRA + 2, knock: VS_EXTRA + 3, tilt: VS_EXTRA + 4, tiltY: VS_EXTRA + 5 } as const
/** Fireflies: up to this many (COUNT picks how many fly), each publishing its
 *  brightness (−1 = not flying). */
export const FIREFLIES = 48
/** Fireflies: the swarm nearer the glass (+1) or further off (−1). */
export const FF_NEAR = VS_EXTRA + FIREFLIES
/** Fireflies: how tightly the swarm has gathered round the X / Y point (0..1;
 *  the point itself is VS.x / VS.y). */
export const FF_GATHER = FF_NEAR + 1
/** Aurora: how far the X / Y point has carried the curtains (VS.x / VS.y are
 *  the point; this is how much it counts, 0..1). */
export const AUR_STEER = VS_EXTRA
/** Murmuration (the flock's centre is VS.x / VS.y, 0..1 across and up the
 *  sky): how near (0..1), its radius (scene units), panic 0..1, where the
 *  falcon is diving (0..1) and how long ago it stooped (s, −1 none), how many
 *  turning waves so far and which way the latest one runs (−1 / +1), the dusk
 *  (0 evening … 1 roosted). */
export const MUR = {
  z: VS_EXTRA,
  spread: VS_EXTRA + 1,
  panic: VS_EXTRA + 2,
  fx: VS_EXTRA + 3,
  fy: VS_EXTRA + 4,
  falcon: VS_EXTRA + 5,
  waves: VS_EXTRA + 6,
  waveDir: VS_EXTRA + 7,
  dusk: VS_EXTRA + 8,
} as const
/** Most starlings a murmuration can hold (COUNT picks how many). */
export const STARLINGS = 1200
/** Rain on a pond: the latest DROPS drops, four values each from RAIN.drops
 *  (across 0..1, near 0..1, size, a count that changes when the slot gets a
 *  new drop), then the lightning flash and how hard it's raining (drops/s). */
export const DROPS = 24
export const RAIN = { drops: VS_EXTRA, flash: VS_EXTRA + DROPS * 4, heavy: VS_EXTRA + DROPS * 4 + 1 } as const
/** The pond's ripples, shared by the engine (the lily pad's bob) and the
 *  screen (the water): pond size (scene units), ripple speed (units/s),
 *  wavenumber (rad/unit), how fast they die away (s), where the pad floats. */
export const POND = { w: 4, d: 3, speed: 0.35, k: 40, fade: 1.5, padX: 0.62, padZ: 0.55 } as const
/** Reef (the school's centre is VS.x / VS.y): how near the school is, its
 *  radius, panic, the barracuda (0..1 across, height, s since it set off or
 *  −1, which way), a scare at a finger (where, s left), the surge (−1..1),
 *  the polyps open (0..1), how many times the school has turned and which way. */
export const REEF = {
  z: VS_EXTRA,
  spread: VS_EXTRA + 1,
  panic: VS_EXTRA + 2,
  bx: VS_EXTRA + 3,
  by: VS_EXTRA + 4,
  pass: VS_EXTRA + 5,
  bdir: VS_EXTRA + 6,
  sx: VS_EXTRA + 7,
  sy: VS_EXTRA + 8,
  scare: VS_EXTRA + 9,
  surge: VS_EXTRA + 10,
  polyps: VS_EXTRA + 11,
  turns: VS_EXTRA + 12,
  turnDir: VS_EXTRA + 13,
} as const
/** How long the barracuda takes to cross (s). */
export const REEF_PASS_S = 4
/** Most fish in the school. */
export const REEF_FISH = 500

/** A drop's ripple at distance r (scene units), `age` s after it landed. */
export function ripple(r: number, age: number, size: number): number {
  const u = r - POND.speed * age
  if (u > 0) return 0 // not there yet
  return ((size * Math.exp(-age / POND.fade)) / (1 + r * 3)) * Math.sin(u * POND.k) * Math.exp(u * 2)
}

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
  /** Starlings: 600 at halfway. */
  starlings: (c: number) => Math.max(80, Math.min(STARLINGS, Math.round(c * 1200))),
  /** Lily pads on the pond: three at halfway. */
  pads: (c: number) => Math.max(1, Math.min(7, Math.round(c * 6))),
  /** Fish in the reef's school: 250 at halfway. */
  fish: (c: number) => Math.max(30, Math.min(REEF_FISH, Math.round(c * 500))),
}

export const VISION_LEDS = LED_BLOCK * (1 + VISION_SCENES.length)

/** Shared by VISION and VISION CORE (the same creature engine). The names are
 *  generic; each scene reads them its own way:
 *
 *  | jack   | JELLY        | GARDEN          | FIREFLIES      | AURORA        | CYMATICS            | MURMURATION     | RAIN             | REEF               |
 *  | TRIG   | bell stroke  | pollen burst    | scatter        | substorm      | knock the plate     | a falcon stoops | a fish rises     | a barracuda passes |
 *  | FEED   | food → size  | food → health   | coupling       | solar wind    | drive               | cohesion        | heavier rain     | plankton           |
 *  | PITCH  | colour/note  | colour/note     | colour/note    | colour/note   | mode + colour       | sunset colour   | sky colour       | water colour       |
 *  | MOVE   | current      | wind            | drift          | curtains      | tilt                | wind            | wind             | surge              |
 *  | GATE   | stroke       | each new stage  | meadow flash   | onset         | new mode / knock    | wave / stoop    | each drop        | school turns       |
 *  | MOTION | tentacles    | stems           | drift          | curtains      | buzz                | swinging        | the lily pad bob | the surge          |
 *  | STATE  | size         | how alive       | sync           | energy        | mode number         | how dense       | how hard it rains| polyps open        |
 *  | DEPTH  | how near     | seeds' height   | swarm's depth  | curtain height| knock's ring        | how near        | where it fell    | school's nearness  |
 *  | CLK    | bell twitch  | flowers bob     | flash on beat  | flare on beat | knock on beat       | wave each bar   | a drop each beat | turn each bar      |
 *  | X / Y  | swims there  | insects follow  | swarm gathers  | curtains move | plate tilts         | flock goes there| rain falls there | school goes there  |
 *
 *  Jack ids stay as first named (hue, sway, grow) so saved patches keep their
 *  cables (new jacks go on the end). LINK carries no voltage: patch it into
 *  VISION VIEW modules. */
export const VISION_INPUTS: ModuleSpec['inputs'] = [
  { id: 'trig', label: 'TRIG' },
  { id: 'feed', label: 'FEED' },
  { id: 'glow', label: 'GLOW' },
  { id: 'hue', label: 'PITCH' },
  { id: 'move', label: 'MOVE' },
  { id: 'rst', label: 'RST' },
  { id: 'clk', label: 'CLK' },
  { id: 'x', label: 'X' },
  { id: 'y', label: 'Y' },
]
export const VISION_OUTPUTS: ModuleSpec['outputs'] = [
  { id: 'gate', label: 'GATE' },
  { id: 'sway', label: 'MOTION' },
  { id: 'grow', label: 'STATE' },
  { id: 'light', label: 'LIGHT' },
  { id: 'link', label: 'LINK' },
  { id: 'depth', label: 'DEPTH' },
]
/** The glass as a touch pad: where the finger is on the scene (0–10 V, held
 *  when it lifts) and a gate while it's down. On VISION and every VIEW. */
export const TOUCH_OUTPUTS: ModuleSpec['outputs'] = [
  { id: 'tx', label: 'TOUCH X' },
  { id: 'ty', label: 'TOUCH Y' },
  { id: 'tgate', label: 'TOUCH' },
]
const TANK_OUTPUTS: ModuleSpec['outputs'] = [...VISION_OUTPUTS, ...TOUCH_OUTPUTS]
export const VISION_PARAMS: ModuleSpec['params'] = [
  { id: 'scene', label: 'SCENE', min: 0, max: VISION_SCENES.length - 1, def: 0, stepped: true, options: [...VISION_SCENES] },
  { id: 'rate', label: 'RATE', min: 0.05, max: 2, def: 0.4, curve: 'exp', unit: 'Hz' },
  { id: 'hue', label: 'HUE', min: 0, max: 1, def: 0.55, unit: '%' },
  { id: 'glow', label: 'GLOW', min: 0, max: 1, def: 0.7, unit: '%' },
  /** How many things the scene has (see countOf); halfway = its classic look. */
  { id: 'count', label: 'COUNT', min: 0, max: 1, def: 0.5, unit: '%' },
  // menu settings (right-click the screen): the garden's world
  { id: 'sky', label: 'GARDEN SKY', min: 0, max: SKY_OPTIONS.length - 1, def: 3, stepped: true, options: SKY_OPTIONS },
  { id: 'trees', label: 'GARDEN TREES', min: 0, max: TREE_OPTIONS.length - 1, def: 2, stepped: true, options: TREE_OPTIONS },
  { id: 'flora', label: 'GARDEN FLOWERS', min: 0, max: FLORA_OPTIONS.length - 1, def: 0, stepped: true, options: FLORA_OPTIONS },
  { id: 'bugs', label: 'GARDEN INSECTS', min: 0, max: BUG_OPTIONS.length - 1, def: 1, stepped: true, options: BUG_OPTIONS },
]
/** VISION's menu-only settings (right-click the screen), in menu order. */
export const VISION_SETTINGS = ['sky', 'trees', 'flora', 'bugs']

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
  ...(['trig', 'feed', 'glow', 'hue', 'move', 'rst', 'clk', 'x', 'y'] as const).map((jack): Control => ({ kind: 'in', jack, x: 0, y: 0 })),
  ...(['gate', 'sway', 'grow', 'light', 'depth', 'link', 'tx', 'ty', 'tgate'] as const).map((jack): Control => ({ kind: 'out', jack, x: 0, y: 0 })),
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
  const spec = { params: VISION_PARAMS, inputs: VISION_INPUTS, outputs: TANK_OUTPUTS }
  const { controls, top } = packRows(rowsThatFit(VISION_CONTROLS, w), spec, w, { grid: true, maxPitch: PITCH + 2 })
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
  tagline: 'Living scenes you patch: jellyfish, a flower garden, fireflies, aurora, cymatics, a starling murmuration, rain on a pond, a coral reef. CV in, CV out; the glass is a touch pad too',
  category: 'Visuals',
  hp: 20,
  panel: BLACK,
  inputs: VISION_INPUTS,
  outputs: TANK_OUTPUTS,
  params: VISION_PARAMS,
  leds: VISION_LEDS,
  controls: visionLayout(20),
  sizes: SCREEN_SIZES,
  layout: visionLayout,
  settings: VISION_SETTINGS,
}
