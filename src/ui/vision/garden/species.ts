import * as THREE from 'three'

/** How a species looks (sizes are multiples of the plant's size). The
 *  engine decides how it lives; this is only its shape and colour. */
export interface Look {
  petals: number
  /** Petal width and length. */
  petalW: number
  petalL: number
  /** Petal angle from the head's axis: closed, + when open, + when wilted. */
  cup: number
  spread: number
  droop: number
  /** The centre: radius, how flat, colour, and whether it glows. */
  centre: number
  centreFlat: number
  centreColor: number
  centreGlow: number
  stem: number
  leaf: number
  leafLong: number
  /** Stem joints the leaves grow from (four leaves). */
  leafAt: number[]
  /** Its petals let go as it dies (a dandelion goes to seed instead). */
  sheds: boolean
  /** Its head turns to follow the sun. */
  tracksSun: boolean
  /** Petal colour from the HUE (0..1), the plant's own shift, and a petal's jitter. */
  color(hue: number, shift: number, out: THREE.Color): THREE.Color
}

const wrap = (h: number) => ((h % 1) + 1) % 1

/** In species order (DAISY, TULIP, SUNFLOWER, DANDELION). */
export const LOOKS: Look[] = [
  {
    // painted daisy: a ring of narrow petals, any colour, a golden eye
    petals: 13, petalW: 0.12, petalL: 0.15, cup: 0.1, spread: 1.3, droop: 1.1,
    centre: 0.028, centreFlat: 0.7, centreColor: 0xffc23a, centreGlow: 1,
    stem: 1, leaf: 1, leafLong: 1, leafAt: [3, 5, 7, 9], sheds: true, tracksSun: false,
    color: (hue, shift, out) => out.setHSL(wrap(hue + shift), 0.75, 0.6),
  },
  {
    // tulip: six broad petals in a cup that only half opens; strap leaves low down
    petals: 6, petalW: 0.22, petalL: 0.17, cup: 0.12, spread: 0.5, droop: 1.3,
    centre: 0.01, centreFlat: 1, centreColor: 0x2a2010, centreGlow: 0,
    stem: 1.15, leaf: 1.1, leafLong: 1.9, leafAt: [1, 2, 3, 4], sheds: true, tracksSun: false,
    color: (hue, shift, out) => out.setHSL(wrap(hue + shift * 1.5 + 0.45), 0.85, 0.52),
  },
  {
    // sunflower: tall and thick, a big dark disc ringed with gold, facing the sun
    petals: 22, petalW: 0.075, petalL: 0.13, cup: 0.9, spread: 0.7, droop: 0.9,
    centre: 0.075, centreFlat: 0.32, centreColor: 0x3a2410, centreGlow: 0,
    stem: 1.9, leaf: 1.7, leafLong: 1.1, leafAt: [3, 5, 7, 9], sheds: true, tracksSun: true,
    color: (_hue, shift, out) => out.setHSL(0.11 + shift * 0.05, 0.95, 0.55),
  },
  {
    // dandelion: short, a shaggy yellow head of many thin petals, a rosette of leaves
    petals: 28, petalW: 0.05, petalL: 0.075, cup: 0.25, spread: 1.15, droop: 0.6,
    centre: 0.012, centreFlat: 1, centreColor: 0xf5c518, centreGlow: 0.5,
    stem: 0.7, leaf: 1.2, leafLong: 1.6, leafAt: [0, 0, 1, 1], sheds: false, tracksSun: false,
    color: (_hue, shift, out) => out.setHSL(0.14 + shift * 0.02, 0.95, 0.55),
  },
]
