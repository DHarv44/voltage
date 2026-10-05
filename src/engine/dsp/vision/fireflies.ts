import { FIREFLIES, VS, VS_EXTRA } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { hueOf, Wander, type Creature, type CreatureInput, type CreatureOutput } from './creature'

const TAU = Math.PI * 2
/** Coupling with FEED unpatched: they find each other within a minute or so. */
const DEFAULT_COUPLING = 0.15

/** Fireflies in a summer meadow. Each is an oscillator that flashes once per
 *  cycle; seeing its neighbours flash nudges its own clock (the Kuramoto model
 *  of how real fireflies synchronise), so a scattered twinkle slowly locks
 *  into a pulsing meadow. FEED sets how strongly they listen to each other,
 *  TRIG startles them back into disorder. GATE fires on a meadow-wide flash,
 *  GROW = how synchronised they are, LIGHT = how much light there is. */
export class Fireflies implements Creature {
  private readonly ph = new Float64Array(FIREFLIES)
  private readonly freq = new Float64Array(FIREFLIES)
  private gate = 0
  private lastMean = 0
  private readonly drift: Wander

  constructor(private readonly rng: Rng) {
    for (let k = 0; k < FIREFLIES; k++) {
      this.ph[k] = rng.next()
      this.freq[k] = 1 + rng.gauss() * 0.08 // each fly's own tempo
    }
    this.drift = new Wander(rng, 0.2, 0.3)
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    if (i.trig) for (let k = 0; k < FIREFLIES; k++) this.ph[k] = this.rng.next()
    const K = i.feedPatched ? Math.min(2, i.feed / 4) : DEFAULT_COUPLING
    // order parameter: the meadow's mean phase and how tightly they agree
    let sx = 0
    let sy = 0
    for (let k = 0; k < FIREFLIES; k++) {
      sx += Math.cos(TAU * this.ph[k])
      sy += Math.sin(TAU * this.ph[k])
    }
    const r = Math.hypot(sx, sy) / FIREFLIES
    const mean = Math.atan2(sy, sx) / TAU
    let light = 0
    for (let k = 0; k < FIREFLIES; k++) {
      const pull = K * r * Math.sin(TAU * (mean - this.ph[k]))
      this.ph[k] = (this.ph[k] + dt * (i.rate * 1.5 * this.freq[k] + pull) + 1) % 1
      // a flash right after each reset, swelling and fading over a few tenths of a
      // second (a real firefly's), plus a faint resting glow
      const b = 0.06 + Math.exp(-this.ph[k] / 0.18) * 0.94
      led[VS_EXTRA + k] = b
      light += b
    }
    const m = (mean + 1) % 1
    if (r > 0.6 && m < this.lastMean - 0.5) this.gate = 0.012 // a meadow-wide flash
    this.lastMean = m
    this.gate = Math.max(0, this.gate - dt)

    const glow = Math.max(0, Math.min(1.5, i.glow * Math.min(1, (light / FIREFLIES) * 3) + i.glowCv / 10))
    o.gate = this.gate > 0 ? 10 : 0
    o.grow = r * 10
    o.sway = Math.max(-5, Math.min(5, this.drift.step(dt) * 5 + i.move * 0.2))
    o.light = Math.min(10, glow * 10)
    led[VS.action] = r
    led[VS.glow] = glow
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.sway] = o.sway / 5
    led[VS.grow] = r
    led[VS.gate] = this.gate > 0 ? 1 : 0
  }
}
