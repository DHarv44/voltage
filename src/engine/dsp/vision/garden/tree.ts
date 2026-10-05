import type { Rng } from '../../util'
import { smoothstep } from '../creature'

const T_SEED = 0
const T_GROW = 1
const T_MATURE = 2
const T_AUTUMN = 3
const T_BARE = 4
const T_FALL = 5
const T_ROT = 6

/** Tree timings (units at RATE 0.4 Hz; a flower lives ~40): trees take ages
 *  to grow, stand for longer, and take their time dying. */
const GROW_TIME = 260
const MATURE = [260, 200]
const TURN_TIME = 30
const LEAF_FALL = 45
const BARE_TIME = 25
const FALL_TIME = 10
const ROT_TIME = 25

/** A tree in the background. Same life as a flower, on a much slower clock and
 *  a much bigger scale: a sapling leafs out and grows for minutes; it stands
 *  for longer; then its leaves turn and fall, it stands bare a while, comes
 *  down, and rots away, and a new one comes up somewhere else. */
export class Tree {
  phase = T_SEED
  x = 0.5
  g = 0
  leaves = 0
  autumn = 0
  fall = 0
  fade = 0
  timer = 0

  constructor(private readonly rng: Rng) {}

  /** A seed somewhere away from the other trees, coming up after `delay`. */
  sow(others: Tree[], delay: number): void {
    let bestGap = -1
    for (let k = 0; k < 8; k++) {
      const at = 0.05 + this.rng.next() * 0.9
      let gap = 1
      for (const o of others) if (o !== this && o.phase !== T_SEED) gap = Math.min(gap, Math.abs(o.x - at))
      if (gap > bestGap) {
        bestGap = gap
        this.x = at
      }
    }
    this.phase = T_SEED
    this.timer = delay
    this.g = this.leaves = this.autumn = this.fall = this.fade = 0
  }

  /** Already partway grown (a garden that has been here a while). */
  established(g: number): void {
    this.phase = T_GROW
    this.g = g
    this.fade = 1
    this.leaves = 1
  }

  get standing(): boolean {
    return this.phase !== T_SEED
  }

  /** `wanted`: the TREES setting still has room for it. A tree no longer
   *  wanted fades away quickly (you turned it down). */
  step(dt: number, speed: number, health: number, light: number, wanted: boolean, others: Tree[]): void {
    const u = dt * speed
    if (!wanted) {
      if (this.phase !== T_SEED) {
        this.fade = Math.max(0, this.fade - dt / 2)
        if (this.fade <= 0) this.sow(others, 5 + this.rng.next() * 10)
      }
      return
    }
    switch (this.phase) {
      case T_SEED:
        this.timer -= u
        if (this.timer <= 0) {
          this.phase = T_GROW
          this.g = 0.01
          this.fade = 1
        }
        break
      case T_GROW:
        this.g = Math.min(1, this.g + (u / GROW_TIME) * (0.4 + 0.6 * light) * Math.min(1, health * 2))
        this.leaves = smoothstep(0.02, 0.12, this.g)
        if (this.g >= 1) {
          this.phase = T_MATURE
          this.timer = MATURE[0] + this.rng.next() * MATURE[1]
        }
        break
      case T_MATURE:
        this.timer -= u * (health < 0.12 ? 3 : 1)
        if (this.timer <= 0) this.phase = T_AUTUMN
        break
      case T_AUTUMN:
        // the leaves turn first, then come down
        if (this.autumn < 1) this.autumn = Math.min(1, this.autumn + u / TURN_TIME)
        else this.leaves = Math.max(0, this.leaves - u / LEAF_FALL)
        if (this.leaves <= 0) {
          this.phase = T_BARE
          this.timer = BARE_TIME
        }
        break
      case T_BARE:
        this.timer -= u
        if (this.timer <= 0) this.phase = T_FALL
        break
      case T_FALL:
        this.fall = Math.min(1, this.fall + u / FALL_TIME)
        if (this.fall >= 1) this.phase = T_ROT
        break
      case T_ROT:
        this.fade = Math.max(0, this.fade - u / ROT_TIME)
        if (this.fade <= 0) this.sow(others, 15 + this.rng.next() * 25)
        break
    }
  }
}
