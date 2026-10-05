import { FLOWER_STAGES, GARDEN_PLANTS, PLANT_VALUES, VS, VS_EXTRA } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { hueOf, smoothstep, Spring2, Wander, type Creature, type CreatureInput, type CreatureOutput } from './creature'

/** Food when FEED is unpatched: a sunny bed. */
const SUNLIGHT = 0.5
const TRIG_LEN = 0.01
const SEED = 0
const GROWING = 1
const BLOOMING = 2
const WILTING = 3
const DEAD = 4

/** One plant's life: seed → sprout and grow → bloom → wilt → die → a new seed
 *  elsewhere. Times scale with RATE (they're for RATE 0.4 Hz). */
class Plant {
  phase = SEED
  x = 0.5
  g = 0
  open = 0
  wilt = 0
  fade = 0
  timer = 0
  stage = 0
  constructor(private readonly rng: Rng) {}

  /** Plant a seed somewhere not too close to the neighbours. */
  sow(others: Plant[], delay: number): void {
    let best = 0.5
    let bestGap = -1
    for (let k = 0; k < 8; k++) {
      const x = 0.1 + this.rng.next() * 0.8
      let gap = 1
      for (const o of others) if (o !== this && o.phase !== SEED) gap = Math.min(gap, Math.abs(o.x - x))
      if (gap > bestGap) {
        bestGap = gap
        best = x
      }
    }
    this.x = best
    this.phase = SEED
    this.timer = delay
    this.g = 0
    this.open = 0
    this.wilt = 0
    this.fade = 0
    this.stage = 0
  }

  /** Returns true when the plant reached a new stage (for the GATE). */
  step(dt: number, speed: number, health: number): boolean {
    const starving = health < 0.12
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
        if (!starving) this.g = Math.min(1, this.g + dt * speed * 0.05 * Math.min(1, health * 2))
        else this.wilt = Math.min(1, this.wilt + dt * speed * 0.03) // a starving sprout droops
        if (!starving) this.wilt = Math.max(0, this.wilt - dt * speed * 0.05)
        if (this.wilt >= 1) {
          this.phase = WILTING
          event = true
        }
        if (this.g >= 0.999) {
          this.phase = BLOOMING
          this.timer = 14 + this.rng.next() * 14 // how long the flower lasts
          event = true
        }
        break
      case BLOOMING:
        this.timer -= dt * speed * (starving ? 4 : 1)
        if (this.timer <= 0) {
          this.phase = WILTING
          event = true
        }
        break
      case WILTING:
        this.wilt = Math.min(1, this.wilt + (dt * speed) / 9)
        if (this.wilt >= 1) {
          this.phase = DEAD
          this.timer = 4
          event = true
        }
        break
      case DEAD:
        this.timer -= dt * speed
        this.fade = Math.max(0, this.timer / 4)
        break
    }
    const blooming = this.phase === BLOOMING || this.phase === WILTING
    const target = blooming ? smoothstep(0.82, 1, this.g) * (1 - this.wilt * 0.8) : 0
    this.open += (target - this.open) * (1 - Math.exp(-dt / 1.5))
    let stage = 0
    while (stage < FLOWER_STAGES.length && this.g >= FLOWER_STAGES[stage]) stage++
    if (stage > this.stage) event = true
    this.stage = stage
    return event
  }
}

/** A flower bed. Several plants each live a whole life — sprout, leaves, bud,
 *  bloom, then wilt and die, and a seed falls somewhere new — so the garden is
 *  always changing. FEED's envelope is the food (sunlight when unpatched);
 *  starve it and blooms wilt early and sprouts droop. GATE fires on every
 *  sprouting, new leaf, bloom and death; GROW = how alive the garden is; SWAY =
 *  the wind in the stems (MOVE adds wind); TRIG makes them shed glowing pollen. */
export class Garden implements Creature {
  private readonly plants: Plant[]
  private health = SUNLIGHT
  private trigT = 0
  private flick = 0
  private readonly wind: Wander
  private readonly stem = new Spring2(2.6, 0.22)

  constructor(private readonly rng: Rng) {
    this.wind = new Wander(rng, 0.3, 0.35)
    this.plants = Array.from({ length: GARDEN_PLANTS }, () => new Plant(rng))
    // the first one is already up; the rest are seeds waiting their turn
    this.plants.forEach((p, k) => p.sow(this.plants, k === 0 ? 0 : 3 + k * 5 + rng.next() * 4))
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    const speed = i.rate / 0.4
    const food = i.feedPatched ? Math.min(1.5, i.feed / 3) : SUNLIGHT
    this.health += (food - this.health) * (1 - Math.exp(-dt / 4))
    let life = 0
    let open = 0
    let wilt = 0
    for (let k = 0; k < this.plants.length; k++) {
      const p = this.plants[k]
      if (p.step(dt, speed, this.health)) this.trigT = TRIG_LEN
      if (p.phase === DEAD && p.timer <= 0) p.sow(this.plants, 2 + this.rng.next() * 8)
      life += p.g * (1 - p.wilt) * p.fade
      open = Math.max(open, p.open)
      wilt = Math.max(wilt, p.wilt * p.fade)
      const b = VS_EXTRA + k * PLANT_VALUES
      led[b] = p.x
      led[b + 1] = p.g
      led[b + 2] = p.open
      led[b + 3] = p.wilt
      led[b + 4] = p.phase === SEED ? 0 : p.fade
    }
    if (i.trig) {
      this.flick = 1
      this.trigT = Math.max(this.trigT, TRIG_LEN)
    }
    this.trigT = Math.max(0, this.trigT - dt)
    this.flick *= Math.exp(-dt / 0.6)

    const gust = this.wind.step(dt) + i.move * 0.15
    const sway = this.stem.step(Math.max(-1.2, Math.min(1.2, gust)), dt)
    const light = Math.max(0, Math.min(1.5, i.glow * (0.2 + 0.5 * open + 0.8 * this.flick) + i.glowCv / 10))

    o.gate = this.trigT > 0 ? 10 : 0
    o.sway = Math.max(-5, Math.min(5, sway * 5))
    o.grow = Math.min(10, (life / this.plants.length) * 20)
    o.light = Math.min(10, light * 10)

    led[VS.action] = Math.min(1, this.flick)
    led[VS.x] = 0.5
    led[VS.y] = 0
    led[VS.tilt] = 0
    led[VS.glow] = light
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.grow] = life / this.plants.length
    led[VS.sway] = sway
    led[VS.wilt] = wilt
    led[VS.gate] = this.trigT > 0 ? 1 : 0
  }
}
