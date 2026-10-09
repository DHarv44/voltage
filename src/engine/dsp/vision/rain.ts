import { DROPS, POND, RAIN, ripple, VS } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { hueOf, type Creature, type CreatureInput, type CreatureOutput } from './creature'

/** Rain heavier than this (drops/s) brings thunder. */
const STORM = 14
/** A finger trailing in the water leaves a ripple this often (s). */
const TRAIL_S = 0.06

/** Rain on a pond. Drops land at random (RATE: how hard it rains; FEED's level
 *  adds to it), each one a GATE and a DEPTH (how near it fell), so the rain
 *  plays a melody; its rings spread and cross, and MOTION is the lily pad
 *  riding them. Heavy rain brings lightning (LIGHT). TRIG: a fish rises (one
 *  big ring). STATE: how hard it's raining. Touch: tap the water, or trail a
 *  finger through it. */
export class Rain implements Creature {
  private readonly x = new Float32Array(DROPS)
  private readonly z = new Float32Array(DROPS)
  private readonly size = new Float32Array(DROPS)
  private readonly age = new Float32Array(DROPS).fill(99)
  private readonly id = new Float32Array(DROPS)
  private slot = 0
  private count = 0
  private heavy = 0
  private gate = 0
  private near = 0.5
  private flash = 0
  private flicker = 0
  private trail = 0

  constructor(private readonly rng: Rng) {}

  /** The sky clears: no rings on the water. */
  reset(): void {
    this.age.fill(99)
    this.size.fill(0)
    this.heavy = this.flash = this.flicker = this.gate = 0
  }

  private drop(x: number, z: number, size: number): void {
    const k = this.slot
    this.slot = (k + 1) % DROPS
    this.x[k] = x
    this.z[k] = z
    this.size[k] = size
    this.age[k] = 0
    this.id[k] = ++this.count
    this.near = z
    this.gate = 0.005
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    const rng = this.rng
    const rate = i.rate * 12 + (i.feedPatched ? Math.min(30, i.feed * 3) : 0)
    this.heavy += (rate - this.heavy) * (1 - Math.exp(-dt / 4))
    if (rng.next() < rate * dt) this.drop(rng.next(), rng.next(), 0.3 + rng.next() * 0.4)
    if (i.trig) this.drop(0.15 + rng.next() * 0.7, 0.2 + rng.next() * 0.6, 1.6) // a fish rises
    const tc = i.touch
    if (tc.tap) this.drop(tc.x, tc.y, 0.9)
    else if (tc.touching && (tc.dx !== 0 || tc.dy !== 0) && (this.trail -= dt) <= 0) {
      this.trail = TRAIL_S
      this.drop(tc.x, tc.y, 0.45)
    }

    // the lily pad rides every ring passing under it
    let h = 0
    for (let k = 0; k < DROPS; k++) {
      this.age[k] += dt
      if (this.age[k] > 8) continue
      const r = Math.hypot((POND.padX - this.x[k]) * POND.w, (POND.padZ - this.z[k]) * POND.d)
      h += ripple(r, this.age[k], this.size[k])
    }

    // thunderstorms: lightning, often in a double flicker
    if (this.heavy > STORM && rng.next() < dt * (this.heavy - STORM) * 0.01) {
      this.flash = 1
      this.flicker = rng.next() < 0.6 ? 0.12 : 0
    }
    if (this.flicker > 0 && (this.flicker -= dt) <= 0) this.flash = 1
    this.flash *= Math.exp(-dt / 0.12)
    this.gate = Math.max(0, this.gate - dt)

    const light = Math.max(0, Math.min(1.5, i.glow * (0.5 + this.flash * 1.4) + i.glowCv / 10))
    const sway = Math.max(-5, Math.min(5, h * 12))
    o.gate = this.gate > 0 ? 10 : 0
    o.sway = sway
    o.grow = Math.min(10, (this.heavy / 30) * 10)
    o.light = Math.min(10, light * 10)
    o.depth = this.near * 10
    for (let k = 0; k < DROPS; k++) {
      const b = RAIN.drops + k * 4
      led[b] = this.x[k]
      led[b + 1] = this.z[k]
      led[b + 2] = this.age[k] > 8 ? 0 : this.size[k]
      led[b + 3] = this.id[k]
    }
    led[RAIN.flash] = this.flash
    led[RAIN.heavy] = this.heavy
    led[VS.action] = this.flash
    led[VS.glow] = light
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.sway] = sway / 5
    led[VS.grow] = Math.min(1, this.heavy / 30)
    led[VS.gate] = this.gate > 0 ? 1 : 0
  }
}
