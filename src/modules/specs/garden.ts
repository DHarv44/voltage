import { VS_EXTRA } from './visionState'

/** The GARDEN scene's shared world: what the engine publishes and the sizes
 *  both sides work from (so insects land on the flowers the renderer draws). */

export const GARDEN_PLANTS = 10
export const GARDEN_TREES = 3
/** Insects: the first BEES are bees, the rest butterflies. */
export const GARDEN_BUGS = 8
export const BEES = 5
/** Dandelion seeds in flight that can take root where they land. */
export const GARDEN_SEEDS = 8

/** Flowers, in species order. */
export const SPECIES = ['DAISY', 'TULIP', 'SUNFLOWER', 'DANDELION'] as const
export const DAISY = 0
export const TULIP = 1
export const SUNFLOWER = 2
export const DANDELION = 3
/** Stem length against a daisy's. */
const TALL = [1, 0.72, 1.6, 0.5]

/** Per-plant values: where, growth, petal opening, wilt (1..2 = the dead stem
 *  falling), visibility, species, dandelion clock (0..1 forming, 1..2 seeds
 *  blown away), size. */
export const PLANT = { x: 0, g: 1, open: 2, wilt: 3, fade: 4, species: 5, puff: 6, size: 7 } as const
export const PLANT_VALUES = 8
/** Per-tree values: where, growth, leaves still on, autumn colour, toppling, visibility. */
export const TREE = { x: 0, g: 1, leaves: 2, autumn: 3, fall: 4, fade: 5 } as const
export const TREE_VALUES = 6
/** Per-insect values: x (0..1 across the bed; < −0.5 = not here), height and
 *  depth (scene units), and the flower it's on: −1 flying, else k + how far
 *  it has settled (0..1). */
export const BUG = { x: 0, y: 1, z: 2, visit: 3 } as const
export const BUG_VALUES = 4
/** Per-seed values: x (0..1), height (< 0 = none), depth. */
export const SEED_VALUES = 3

/** Where each part of the garden's state sits in its LED block. */
export const GARDEN = {
  /** Time of day 0..1: 0 midnight, ¼ sunrise, ½ noon, ¾ sunset. */
  tod: VS_EXTRA,
  plants: VS_EXTRA + 1,
  trees: VS_EXTRA + 1 + GARDEN_PLANTS * PLANT_VALUES,
  bugs: VS_EXTRA + 1 + GARDEN_PLANTS * PLANT_VALUES + GARDEN_TREES * TREE_VALUES,
  seeds: VS_EXTRA + 1 + GARDEN_PLANTS * PLANT_VALUES + GARDEN_TREES * TREE_VALUES + GARDEN_BUGS * BUG_VALUES,
  end: VS_EXTRA + 1 + GARDEN_PLANTS * PLANT_VALUES + GARDEN_TREES * TREE_VALUES + GARDEN_BUGS * BUG_VALUES + GARDEN_SEEDS * SEED_VALUES,
} as const

/** Menu settings (right-click the screen). */
export const SKY_OPTIONS = ['CYCLE', 'DAY', 'GOLDEN', 'DUSK', 'NIGHT']
/** Time of day each fixed sky holds (CYCLE runs the clock instead). */
export const SKY_TOD = [-1, 0.5, 0.7, 0.765, 0.97]
export const TREE_OPTIONS = ['NONE', 'ONE', 'TWO', 'THREE']
export const FLORA_OPTIONS = ['MIXED', 'DAISIES', 'TULIPS', 'SUNFLOWERS', 'DANDELIONS']
export const BUG_OPTIONS = ['NONE', 'FEW', 'MANY']
/** Bees and butterflies for each BUGS setting. */
export const BUG_COUNTS = [
  [0, 0],
  [2, 1],
  [5, 3],
]

/** Flower growth stages (fraction of full growth): four leaves, the bud, the bloom. */
export const FLOWER_STAGES = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]

const ease = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const hash = (x: number): number => {
  const h = Math.sin(x * 917.3) * 43758.5453
  return h - Math.floor(h)
}

/** Height of the sun: −1 midnight … 1 noon. */
export const sunHeight = (tod: number): number => Math.sin((tod - 0.25) * Math.PI * 2)
/** How much daylight there is (0 night … 1 day), with twilight between. */
export const daylight = (tod: number): number => ease(-0.12, 0.25, sunHeight(tod))

/** Stem length (scene units) of a plant: its size, species and growth. */
export const plantHeight = (size: number, species: number, g: number): number => 1.05 * size * (TALL[species] ?? 1) * ease(0, 0.8, g) + 0.02
/** How far back in the bed a plant at x stands (stable for that spot). */
export const plantDepth = (x: number): number => 0.15 + (hash(x) - 0.5) * 0.9
/** A tree at x: how far back it stands (the first is the garden's own tree,
 *  just behind the flower bed; the rest stand back at the edge of the wood). */
export const treeDepth = (slot: number, x: number): number => (slot === 0 ? -0.55 : -9 - hash(x * 3.7 + 1) * 6)
/** How tall a tree at x is at growth g, to scale with the flowers (about a
 *  stem's length, a third of a metre or so): a sapling no taller than them,
 *  a grown tree a dozen times taller. */
export const treeHeight = (x: number, g: number): number => (0.25 + 13 * Math.pow(g, 0.85)) * (0.8 + hash(x * 2.3) * 0.4)
