import { FLOWER_STAGES, VS } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { hueOf, smoothstep, Spring2, Wander, type Creature, type CreatureInput, type CreatureOutput } from './creature'

/** Food when FEED is unpatched: a sunny windowsill. */
const SUNLIGHT = 0.5
const TRIG_LEN = 0.01

/** A flower that grows from what you feed it. FEED's envelope is its food (or
 *  sunlight when unpatched); starved, it wilts and dies back, and feeding it
 *  again brings it back. GATE fires on each new leaf, bud and bloom,
 *  SWAY = stem in the wind (MOVE adds wind), GROW = growth, LIGHT = glow.
 *  TRIG makes the petals shiver and shed glowing pollen. */
export class Flower implements Creature {
  private g = 0.02
  private health = SUNLIGHT
  private wilt = 0
  private stage = 0
  private trigT = 0
  private flick = 0
  private open = 0
  private readonly wind: Wander
  private readonly stem = new Spring2(2.6, 0.22)

  constructor(rng: Rng) {
    this.wind = new Wander(rng, 0.3, 0.35)
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    const food = i.feedPatched ? Math.min(1.5, i.feed / 3) : SUNLIGHT
    this.health += (food - this.health) * (1 - Math.exp(-dt / 4))
    const starving = this.health < 0.12
    this.wilt += ((starving ? 1 : 0) - this.wilt) * (1 - Math.exp(-dt / 5))

    if (!starving && this.wilt < 0.5) this.g += dt * i.rate * 0.12 * Math.min(1, this.health)
    else if (this.wilt > 0.85) this.g -= dt * 0.01 // dying back
    this.g = Math.min(1, Math.max(0.02, this.g))

    // A new stage fires the GATE; dying back below one lets it fire again later.
    let stage = 0
    while (stage < FLOWER_STAGES.length && this.g >= FLOWER_STAGES[stage]) stage++
    if (stage > this.stage) this.trigT = TRIG_LEN
    this.stage = stage
    if (i.trig) {
      this.flick = 1
      this.trigT = Math.max(this.trigT, TRIG_LEN)
    }
    this.trigT = Math.max(0, this.trigT - dt)
    this.flick *= Math.exp(-dt / 0.6)

    const bloom = smoothstep(0.82, 1, this.g) * (1 - this.wilt)
    this.open += (bloom - this.open) * (1 - Math.exp(-dt / 1.5))

    const gust = this.wind.step(dt) + i.move * 0.15
    const sway = this.stem.step(Math.max(-1.2, Math.min(1.2, gust)) * (0.4 + 0.6 * this.g), dt)
    const light = Math.max(0, Math.min(1.5, i.glow * (0.2 + 0.5 * this.open + 0.8 * this.flick) + i.glowCv / 10))

    o.gate = this.trigT > 0 ? 10 : 0
    o.sway = Math.max(-5, Math.min(5, sway * 5))
    o.grow = this.g * 10
    o.light = Math.min(10, light * 10)

    led[VS.action] = Math.min(1, this.open + this.flick * 0.15)
    led[VS.x] = 0.5
    led[VS.y] = 0
    led[VS.tilt] = 0
    led[VS.glow] = light
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.grow] = this.g
    led[VS.sway] = sway
    led[VS.wilt] = this.wilt
    led[VS.gate] = this.trigT > 0 ? 1 : 0
  }
}
