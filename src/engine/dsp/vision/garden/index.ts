import {
  BUG_COUNTS,
  daylight,
  DANDELION,
  GARDEN,
  GARDEN_PLANTS,
  GARDEN_TREES,
  PLANT,
  PLANT_VALUES,
  plantDepth,
  plantHeight,
  TREE,
  TREE_VALUES,
} from '../../../../modules/specs/garden'
import { countOf, VS } from '../../../../modules/specs/vision'
import type { Rng } from '../../util'
import { hueOf, Spring2, Wander, type Creature, type CreatureInput, type CreatureOutput } from '../creature'
import { Bugs } from './bugs'
import { CLOCK, DEAD, GROWING, Plant, SEED, WILTING } from './plant'
import { Seeds } from './seeds'
import { Sky } from './sky'
import { T_SEED, Tree } from './tree'

/** Food when FEED is unpatched: a sunny bed. */
const SUNLIGHT = 0.5
const TRIG_LEN = 0.01
/** MIXED flowers: how likely each species is (DAISY, TULIP, SUNFLOWER, DANDELION). */
const MIX = [0.35, 0.25, 0.15, 0.25]
/** Seeds each dandelion clock lets fly that can take root (the rest is fluff). */
const CLOCK_SEEDS = 5

/** A garden. Flowers of several kinds each live a whole life — sprout, leaves,
 *  bud, bloom, then wilt, topple and rot, and a seed comes up somewhere new —
 *  under trees that do the same on a far slower clock, through days and nights.
 *  Bees and butterflies carry pollen between flowers of a kind, and pollinated
 *  flowers seed beside themselves; dandelions go to seed clocks that the wind
 *  scatters, and come up where the seeds land. FEED's envelope is the food
 *  (sunlight when unpatched); GATE fires on every new stage; GROW = how alive
 *  the garden is; SWAY = the wind (MOVE adds wind); TRIG shakes pollen and
 *  seeds loose and startles the insects. Touch: press the soil to plant a
 *  seed there, touch the air for pollen, drag for wind. */
export class Garden implements Creature {
  private readonly plants: Plant[]
  private readonly trees: Tree[]
  private readonly bugs: Bugs
  private readonly seeds: Seeds
  private readonly sky = new Sky()
  /** Clock seeds launched so far, per plant. */
  private readonly flown = new Uint8Array(GARDEN_PLANTS)
  private health = SUNLIGHT
  private trigT = 0
  private flick = 0
  /** Wind from a finger dragged across the glass. */
  private breath = 0
  private readonly wind: Wander
  private readonly stem = new Spring2(2.6, 0.22)

  constructor(private readonly rng: Rng) {
    this.wind = new Wander(rng, 0.3, 0.35)
    this.plants = Array.from({ length: GARDEN_PLANTS }, () => new Plant(rng))
    // the first one is already up; the rest are seeds waiting their turn
    this.plants.forEach((p, k) => p.sow(this.plants, k === 0 ? 0 : 3 + (k % 5) * 5 + rng.next() * 4, this.pick(0)))
    // trees start as seeds too: the first sapling comes up at once, the
    // others a while later, so they're never all the same age
    this.trees = Array.from({ length: GARDEN_TREES }, () => new Tree(rng))
    this.trees.forEach((t, k) => t.sow(this.trees, k === 0 ? 0 : 25 + k * 35 + rng.next() * 20))
    this.bugs = new Bugs(rng)
    this.seeds = new Seeds(rng)
  }

  /** Bare soil at dusk again: the first flower and sapling up at once, the
   *  rest seeds waiting their turn (as when it was planted). */
  reset(): void {
    const plants = this.plants
    const trees = this.trees
    for (let k = 0; k < plants.length; k++) plants[k].phase = SEED
    for (let k = 0; k < plants.length; k++) plants[k].sow(plants, k === 0 ? 0 : 3 + (k % 5) * 5 + this.rng.next() * 4, this.pick(0))
    for (let k = 0; k < trees.length; k++) trees[k].phase = T_SEED
    for (let k = 0; k < trees.length; k++) trees[k].sow(trees, k === 0 ? 0 : 25 + k * 35 + this.rng.next() * 20)
    this.bugs.reset()
    this.seeds.reset()
    this.sky.tod = 0.765
    this.flown.fill(0)
    this.health = SUNLIGHT
    this.trigT = this.flick = this.breath = 0
    this.wind.v = 0
    this.stem.pos = this.stem.vel = 0
  }

  /** A species for a new plant under the FLOWERS setting. */
  private pick(flora: number): number {
    if (flora > 0) return flora - 1
    let r = this.rng.next()
    for (let s = 0; s < MIX.length; s++) if ((r -= MIX[s]) <= 0) return s
    return 0
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    const speed = i.rate / 0.4
    const opts = i.opts
    const food = i.feedPatched ? Math.min(1.5, i.feed / 3) : SUNLIGHT
    this.health += (food - this.health) * (1 - Math.exp(-dt / 4))
    this.sky.step(dt, speed, opts.sky)
    const light = daylight(this.sky.tod)
    const counts = BUG_COUNTS[opts.bugs] ?? BUG_COUNTS[0]
    const nBees = counts[0]
    const nFlies = counts[1]
    const insects = nBees + nFlies > 0
    let life = 0
    let open = 0
    let wilt = 0
    // COUNT sets how many plants the bed holds; extra seeds wait in the soil
    // (a plant already up still lives out its life when you turn it down)
    const n = countOf.plants(i.count)
    let growing = 0
    let wilting = 0
    let nextSeed: Plant | null = null
    let nextActive = false
    let calledUp = false
    for (let k = 0; k < this.plants.length; k++) {
      const p = this.plants[k]
      const active = k < n
      if (active || p.phase !== SEED || p.called) if (p.step(dt, speed, this.health, light)) this.trigT = TRIG_LEN
      if (p.phase === DEAD && p.timer <= 0) this.reseed(p, k, opts.flora, insects)
      if (p.phase === GROWING) growing++
      if (p.phase === WILTING) wilting++
      if (p.phase === SEED && p.called) calledUp = true // a successor is already on its way
      // the next generation: a waiting seed, preferring one inside COUNT
      if (p.phase === SEED && !p.called && (!nextSeed || (active && !nextActive) || (active === nextActive && p.timer < nextSeed.timer))) {
        nextSeed = p
        nextActive = active
      }
      if (p.phase === CLOCK) this.blow(p, k)
      life += p.g * (1 - p.wilt) * p.fade
      open = Math.max(open, p.open)
      wilt = Math.max(wilt, p.wilt * p.fade)
    }
    // Succession: as a flower wilts, the next one must already be on its way
    // up, so the bed is never bare. If nothing is growing, the soonest seed
    // comes up now, even one beyond COUNT: generations overlap for a while.
    if (wilting > 0 && growing === 0 && !calledUp && nextSeed) {
      if (nextActive) nextSeed.timer = Math.min(nextSeed.timer, 1)
      else nextSeed.plantAt(nextSeed.x) // borrowed: sprouts almost at once
    }
    // Touch: press the soil to plant a seed there (if one is waiting its turn);
    // touch the air to shake the flowers' pollen loose.
    const tc = i.touch
    if (tc.tap) {
      if (tc.y < 0.04) this.waiting(n)?.plantAt(tc.x, this.pick(opts.flora))
      else this.flick = 1
    }
    this.breath += ((tc.touching ? Math.max(-1.2, Math.min(1.2, (tc.dx / dt) * 0.8)) : 0) - this.breath) * (1 - Math.exp(-dt / 0.5))
    if (i.trig) {
      this.flick = 1
      this.trigT = Math.max(this.trigT, TRIG_LEN)
    }
    this.trigT = Math.max(0, this.trigT - dt)
    this.flick *= Math.exp(-dt / 0.6)

    const gust = this.wind.step(dt) + i.move * 0.15 + this.breath
    const sway = this.stem.step(Math.max(-1.2, Math.min(1.2, gust)), dt)

    // seeds on the wind take root where they land
    this.seeds.step(dt, sway)
    for (let k = 0; k < this.seeds.landed.length; k++) {
      const x = this.seeds.landed[k]
      if (x >= 0) this.waiting(n)?.plantAt(x, DANDELION)
    }
    if (this.bugs.step(dt, light, this.plants, sway, nBees, nFlies, this.flick) > 0) this.trigT = TRIG_LEN
    for (let k = 0; k < this.trees.length; k++) this.trees[k].step(dt, speed, this.health, light, k < opts.trees, this.trees)

    const glowLight = Math.max(0, Math.min(1.5, i.glow * (0.2 + 0.5 * open + 0.8 * this.flick) + i.glowCv / 10))
    o.gate = this.trigT > 0 ? 10 : 0
    o.sway = Math.max(-5, Math.min(5, sway * 5))
    o.grow = Math.min(10, (life / this.plants.length) * 20)
    o.light = Math.min(10, glowLight * 10)
    o.depth = Math.min(10, this.seeds.highest() * 8) // how high the dandelion seeds are flying
    this.publish(led, sway, glowLight, life, wilt, i)
  }

  /** A dandelion clock in the wind: gusts (and TRIG, and taps) take its
   *  seeds, a few of which fly far enough to take root. */
  private blow(p: Plant, k: number): void {
    if (p.puff < 1) {
      this.flown[k] = 0
      return
    }
    p.shed(Math.abs(this.stem.pos) * 0.004 + this.flick * 0.02)
    const due = Math.floor((p.puff - 1) * CLOCK_SEEDS)
    if (due > this.flown[k]) {
      this.flown[k] = due
      this.seeds.launch(p.x, plantHeight(p.size, p.species, p.g), plantDepth(p.x))
    }
  }

  /** A dead plant's slot sows again. With insects about, a pollinated flower
   *  seeds near itself (its own kind, in MIXED); one never visited comes up
   *  later, anywhere. With none, seeds come up anywhere as before. */
  private reseed(p: Plant, k: number, flora: number, insects: boolean): void {
    this.flown[k] = 0
    if (insects && p.pollinated && p.species !== DANDELION) {
      const near = p.x + (this.rng.next() - 0.5) * 0.24
      p.sow(this.plants, 2 + this.rng.next() * 4, flora === 0 ? p.species : this.pick(flora), near)
    } else p.sow(this.plants, (insects ? 6 : 2) + this.rng.next() * (insects ? 10 : 8), this.pick(flora))
  }

  /** A seed waiting its turn in the soil (inside COUNT), for a planting. */
  private waiting(n: number): Plant | null {
    let w: Plant | null = null
    for (let k = 0; k < n; k++) {
      const p = this.plants[k]
      if (p.phase === SEED && !p.called && (!w || p.timer > w.timer)) w = p
    }
    return w
  }

  private publish(led: Float32Array, sway: number, glow: number, life: number, wilt: number, i: CreatureInput): void {
    led[GARDEN.tod] = this.sky.tod
    for (let k = 0; k < this.plants.length; k++) {
      const p = this.plants[k]
      const b = GARDEN.plants + k * PLANT_VALUES
      led[b + PLANT.x] = p.x
      led[b + PLANT.g] = p.g
      led[b + PLANT.open] = p.open
      led[b + PLANT.wilt] = p.wilt + p.fall // 0..1 wilting, 1..2 falling to the ground
      led[b + PLANT.fade] = p.phase === SEED ? 0 : p.fade
      led[b + PLANT.species] = p.species
      led[b + PLANT.puff] = p.puff
      led[b + PLANT.size] = p.size
    }
    for (let k = 0; k < this.trees.length; k++) {
      const t = this.trees[k]
      const b = GARDEN.trees + k * TREE_VALUES
      led[b + TREE.x] = t.x
      led[b + TREE.g] = t.g
      led[b + TREE.leaves] = t.leaves
      led[b + TREE.autumn] = t.autumn
      led[b + TREE.fall] = t.fall
      led[b + TREE.fade] = t.standing ? t.fade : 0
    }
    this.bugs.publish(led, GARDEN.bugs)
    this.seeds.publish(led, GARDEN.seeds)

    led[VS.action] = Math.min(1, this.flick)
    led[VS.x] = 0.5
    led[VS.y] = 0
    led[VS.tilt] = 0
    led[VS.glow] = glow
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.grow] = life / this.plants.length
    led[VS.sway] = sway
    led[VS.wilt] = wilt
    led[VS.gate] = this.trigT > 0 ? 1 : 0
  }
}
