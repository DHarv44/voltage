import { AUR_STEER, VS } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { hueOf, Spring2, steerTo, Wander, type Creature, type CreatureInput, type CreatureOutput } from './creature'

/** Northern lights. Quiet arcs ripple overhead; every so often (RATE) a
 *  substorm breaks out and the curtains flare and dance, then settle over
 *  ten seconds or so. TRIG sets one off; FEED's level pushes the activity
 *  (solar wind). GATE fires at each substorm onset, LIGHT = activity, SWAY =
 *  the curtains' motion, GROW = the storm's built-up energy. Touch: tap for a
 *  substorm, drag to push the curtains. */
export class Aurora implements Creature {
  private activity = 0.2
  private energy = 0
  private gate = 0
  private push = 0
  /** Carried to the X / Y point (0..1), and where it is. */
  private steer = 0
  private sx = 0.5
  private sy = 0.5
  private readonly wind: Wander
  private readonly curtain = new Spring2(1.4, 0.3)

  constructor(private readonly rng: Rng) {
    this.wind = new Wander(rng, 0.15, 0.25)
  }

  reset(): void {
    this.activity = 0.2
    this.energy = this.gate = this.push = this.steer = 0
    this.sx = this.sy = 0.5
    this.wind.v = 0
    this.curtain.pos = this.curtain.vel = 0
  }

  private substorm(): void {
    this.activity = 1
    this.gate = 0.012
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    // Touch: tap sets off a substorm, dragging pushes the curtains.
    const tc = i.touch
    if (i.trig || tc.tap) this.substorm()
    else if (this.rng.next() < dt * i.rate * 0.12) this.substorm() // RATE 0.4 → about one every 20 s
    this.push += ((tc.touching ? Math.max(-1, Math.min(1, (tc.dx / dt) * 0.6)) : 0) - this.push) * (1 - Math.exp(-dt / 0.6))
    const base = 0.15 + (i.feedPatched ? Math.min(0.8, i.feed / 6) : 0)
    this.activity += (base - this.activity) * (1 - Math.exp(-dt / 9))
    // CLK: the curtains flare on every beat (the flare shows in the light, not the storm's build-up)
    const flare = i.pulse * 0.45
    // X / Y: the curtains drift to the point in the sky
    this.steer = steerTo(this.steer, i.steer ? 1 : 0, dt, 2)
    this.sx = steerTo(this.sx, i.steer ? i.sx : 0.5, dt, 1.2)
    this.sy = steerTo(this.sy, i.steer ? i.sy : 0.5, dt, 1.2)
    this.energy += (this.activity - this.energy) * (1 - Math.exp(-dt / 30))
    this.gate = Math.max(0, this.gate - dt)
    const sway = this.curtain.step(this.wind.step(dt) * (0.4 + this.activity) + i.move * 0.1 + this.push, dt)
    const light = Math.max(0, Math.min(1.5, i.glow * (this.activity + flare) * 1.4 + i.glowCv / 10))
    o.gate = this.gate > 0 ? 10 : 0
    o.light = Math.min(10, light * 10)
    o.sway = Math.max(-5, Math.min(5, sway * 12))
    o.grow = this.energy * 10
    o.depth = Math.min(10, this.activity * 10) // a storm lifts the curtains higher
    led[VS.action] = Math.min(1.4, this.activity + flare)
    led[VS.x] = this.sx
    led[VS.y] = this.sy
    led[AUR_STEER] = this.steer
    led[VS.glow] = light
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.sway] = sway
    led[VS.grow] = this.energy
    led[VS.gate] = this.gate > 0 ? 1 : 0
  }
}
