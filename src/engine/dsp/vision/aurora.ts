import { VS } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { hueOf, Spring2, Wander, type Creature, type CreatureInput, type CreatureOutput } from './creature'

/** Northern lights. Quiet arcs ripple overhead; every so often (RATE) a
 *  substorm breaks out and the curtains flare and dance, then settle over
 *  ten seconds or so. TRIG sets one off; FEED's level pushes the activity
 *  (solar wind). GATE fires at each substorm onset, LIGHT = activity, SWAY =
 *  the curtains' motion, GROW = the storm's built-up energy. */
export class Aurora implements Creature {
  private activity = 0.2
  private energy = 0
  private gate = 0
  private readonly wind: Wander
  private readonly curtain = new Spring2(1.4, 0.3)

  constructor(private readonly rng: Rng) {
    this.wind = new Wander(rng, 0.15, 0.25)
  }

  private substorm(): void {
    this.activity = 1
    this.gate = 0.012
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    if (i.trig) this.substorm()
    else if (this.rng.next() < dt * i.rate * 0.12) this.substorm() // RATE 0.4 → about one every 20 s
    const base = 0.15 + (i.feedPatched ? Math.min(0.8, i.feed / 6) : 0)
    this.activity += (base - this.activity) * (1 - Math.exp(-dt / 9))
    this.energy += (this.activity - this.energy) * (1 - Math.exp(-dt / 30))
    this.gate = Math.max(0, this.gate - dt)
    const sway = this.curtain.step(this.wind.step(dt) * (0.4 + this.activity) + i.move * 0.1, dt)
    const light = Math.max(0, Math.min(1.5, i.glow * this.activity * 1.4 + i.glowCv / 10))
    o.gate = this.gate > 0 ? 10 : 0
    o.light = Math.min(10, light * 10)
    o.sway = Math.max(-5, Math.min(5, sway * 5))
    o.grow = this.energy * 10
    led[VS.action] = this.activity
    led[VS.glow] = light
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.sway] = sway
    led[VS.grow] = this.energy
    led[VS.gate] = this.gate > 0 ? 1 : 0
  }
}
