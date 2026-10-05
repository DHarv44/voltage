import { DANDELION, FLOWER_STAGES, SUNFLOWER, TULIP } from '../../../../modules/specs/garden'
import type { Rng } from '../../util'
import { smoothstep } from '../creature'

export const SEED = 0
export const GROWING = 1
export const BLOOMING = 2
/** Dandelions only: the flower has closed and become a seed clock. */
export const CLOCK = 3
export const WILTING = 4
export const DEAD = 5

/** After it dies: the stem topples to the soil over FALL, then lies there and
 *  fades over ROT (all times are for RATE 0.4 Hz). */
const FALL = 7
const ROT = 6
/** Per species (DAISY, TULIP, SUNFLOWER, DANDELION): growth per unit time,
 *  and how long the flower lasts (shortest, + up to). */
const GROW = [0.05, 0.06, 0.03, 0.08]
const BLOOM = [
  [14, 14],
  [12, 10],
  [30, 20],
  [8, 6],
]
/** A dandelion's clock: how long it takes to form, and how fast it loses
 *  seeds with no wind at all (the wind does most of it). */
const CLOCK_FORM = 6
const CLOCK_DRIFT = 1 / 40

/** One plant's life: seed → sprout and grow → bloom → (dandelion: seed
 *  clock) → wilt → topple → rot → a new seed. Species change the timings and
 *  habits: sunflowers grow slow and tall and stay open at night; the others
 *  close their flowers in the dark. */
export class Plant {
  phase = SEED
  x = 0.5
  g = 0
  open = 0
  wilt = 0
  fall = 0
  fade = 0
  /** Dandelions: 0..1 the clock forming, 1..2 its seeds blown away. */
  puff = 0
  timer = 0
  stage = 0
  species = 0
  size = 1
  /** An insect brought pollen from another of its kind: it will set seed. */
  pollinated = false
  /** Called up early (by hand, a landed seed, or as the next generation): it
   *  comes up even if it's beyond COUNT, then lives a normal life. */
  called = false

  constructor(private readonly rng: Rng) {}

  /** A seed somewhere: at x, or not too close to the neighbours. */
  sow(others: Plant[], delay: number, species: number, x?: number): void {
    if (x === undefined) {
      let bestGap = -1
      x = 0.5
      for (let k = 0; k < 8; k++) {
        const at = 0.1 + this.rng.next() * 0.8
        let gap = 1
        for (const o of others) if (o !== this && o.phase !== SEED) gap = Math.min(gap, Math.abs(o.x - at))
        if (gap > bestGap) {
          bestGap = gap
          x = at
        }
      }
    }
    this.x = Math.min(0.92, Math.max(0.08, x))
    this.species = species
    this.size = 0.75 + this.rng.next() * 0.4
    this.called = false
    this.pollinated = false
    this.phase = SEED
    this.timer = delay
    this.g = 0
    this.open = 0
    this.wilt = 0
    this.fall = 0
    this.fade = 0
    this.puff = 0
    this.stage = 0
  }

  /** A seed pressed in (by hand, or landed from a dandelion): up almost at once. */
  plantAt(x: number, species = this.species): void {
    this.x = Math.min(0.92, Math.max(0.08, x))
    this.species = species
    this.timer = 0.4
    this.called = true
  }

  /** Blow `n` of a dandelion clock's seeds away (fraction of the clock). */
  shed(n: number): void {
    if (this.phase === CLOCK && this.puff >= 1) this.puff = Math.min(2, this.puff + n)
  }

  /** Returns true when the plant reached a new stage (for the GATE).
   *  `light` = daylight 0..1: flowers grow mostly by day and close at night. */
  step(dt: number, speed: number, health: number, light: number): boolean {
    const starving = health < 0.12
    const s = this.species
    let event = false
    switch (this.phase) {
      case SEED:
        this.timer -= dt * speed
        if (this.timer <= 0 && !starving) {
          this.phase = GROWING
          this.g = 0.02
          this.fade = 1
          event = true
        }
        break
      case GROWING:
        if (!starving) this.g = Math.min(1, this.g + dt * speed * GROW[s] * Math.min(1, health * 2) * (0.35 + 0.65 * light))
        else this.wilt = Math.min(1, this.wilt + dt * speed * 0.03) // a starving sprout droops
        if (!starving) this.wilt = Math.max(0, this.wilt - dt * speed * 0.05)
        if (this.wilt >= 1) {
          this.phase = WILTING
          event = true
        }
        if (this.g >= 0.999) {
          this.phase = BLOOMING
          this.timer = BLOOM[s][0] + this.rng.next() * BLOOM[s][1]
          event = true
        }
        break
      case BLOOMING:
        this.timer -= dt * speed * (starving ? 4 : 1)
        if (this.timer <= 0) {
          this.phase = s === DANDELION ? CLOCK : WILTING
          event = true
        }
        break
      case CLOCK:
        // the yellow head closes, then opens again as a white seed clock;
        // once formed the wind takes the seeds (shed), a few drift off anyway
        if (this.puff < 1) this.puff = Math.min(1, this.puff + (dt * speed) / CLOCK_FORM)
        else this.puff = Math.min(2, this.puff + dt * speed * CLOCK_DRIFT)
        if (this.puff >= 2) {
          this.phase = WILTING // a bare stalk
          event = true
        }
        break
      case WILTING:
        this.wilt = Math.min(1, this.wilt + (dt * speed) / (s === DANDELION ? 5 : 9))
        if (this.wilt >= 1) {
          this.phase = DEAD
          this.timer = FALL + ROT
          event = true
        }
        break
      case DEAD:
        this.timer -= dt * speed
        this.fall = Math.min(1, (FALL + ROT - this.timer) / FALL)
        this.fade = Math.max(0, Math.min(1, this.timer / ROT))
        break
    }
    const blooming = this.phase === BLOOMING || (this.phase === WILTING && s !== DANDELION)
    // daisies ("day's eye"), tulips and dandelions shut at night; sunflowers don't
    const shut = s === SUNFLOWER ? 1 : 0.12 + 0.88 * light
    const target = blooming ? smoothstep(0.82, 1, this.g) * (1 - this.wilt * 0.8) * (s === TULIP ? shut * shut : shut) : 0
    this.open += (target - this.open) * (1 - Math.exp(-dt / 1.5))
    let stage = 0
    while (stage < FLOWER_STAGES.length && this.g >= FLOWER_STAGES[stage]) stage++
    if (stage > this.stage) event = true
    this.stage = stage
    return event
  }

  /** In bloom and open: worth an insect's visit. */
  get inviting(): boolean {
    return this.phase === BLOOMING && this.open > 0.45 && this.fade > 0.9
  }
}
