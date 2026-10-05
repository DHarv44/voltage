import { JELLY_PITCH, JELLY_Z, VS } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { hueOf, smoothstep, Spring2, Wander, type Creature, type CreatureInput, type CreatureOutput } from './creature'

/** Contraction stroke and relaxation times of a moon-jelly-sized bell (s). */
const STROKE = 0.3
const RELAX = 0.5
/** Thrust while contracting, drag, and negative buoyancy (tank heights/s²):
 *  each stroke carries the bell about one body length. */
const THRUST = 0.45
const DRAG = 1.6
const SINK = 0.045

/** Bioluminescent jellyfish. The bell pulses (free-running at RATE, or on TRIG),
 *  each stroke jets it along its axis, in 3D: the bell leans sideways (tilt)
 *  and toward or away from the glass (pitch), so it roams the tank's depth too.
 *  Between strokes it sinks and drifts with the currents. GATE = contraction stroke, SWAY = tentacle trail,
 *  GROW = body size (fed by FEED), LIGHT = bioluminescence. */
export class Jelly implements Creature {
  private timer = 0
  private period = 1
  private stroking = false
  private strokeT = 0
  private c = 0
  private x = 0.5
  private y = 0.45
  private vx = 0
  private vy = 0
  private tilt = 0
  private z = 0.5
  private vz = 0
  private pitch = 0
  private flash = 0
  private size = 0.5
  private readonly current: Wander
  private readonly currentZ: Wander
  private readonly trail = new Spring2(4, 0.28)

  constructor(private readonly rng: Rng) {
    this.current = new Wander(rng, 0.15, 0.05)
    this.currentZ = new Wander(rng, 0.12, 0.05)
    this.timer = rng.next()
    this.z = 0.3 + rng.next() * 0.4
  }

  private pulse(): void {
    if (this.c > 0.6) return // still mid-stroke: the bell can't fire again yet
    this.stroking = true
    this.strokeT = 0
    this.flash = 1
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    if (i.trigPatched) {
      if (i.trig) this.pulse()
    } else {
      this.timer += dt * i.rate
      if (this.timer >= this.period) {
        this.timer -= this.period
        this.period = 1 + this.rng.gauss() * 0.08 // real bells never keep perfect time
        this.pulse()
      }
    }

    // Bell: a quick contraction stroke, then an elastic relaxation.
    const stroke = STROKE * (0.8 + 0.4 * this.size)
    if (this.stroking) {
      this.strokeT += dt
      this.c = smoothstep(0, 1, this.strokeT / stroke)
      if (this.strokeT >= stroke) this.stroking = false
    } else this.c *= Math.exp(-dt / RELAX)

    // Body: jet along the bell axis, drag, sink, carried by the current.
    const ceiling = 1 - smoothstep(0.55, 0.92, this.y)
    const jet = this.stroking ? THRUST * ceiling : 0
    const cur = this.current.step(dt) + i.move * 0.03
    const curZ = this.currentZ.step(dt)
    // the jet runs along the bell's axis: leaned by tilt (sideways) and pitch (depth)
    const up = Math.cos(this.tilt) * Math.cos(this.pitch)
    this.vx += (jet * Math.sin(this.tilt) + (cur - this.vx) * 0.6) * dt
    this.vy += (jet * up - SINK) * dt
    this.vz += (jet * Math.sin(this.pitch) + (curZ - this.vz) * 0.6) * dt
    const drag = Math.exp(-dt * DRAG)
    this.vx *= drag
    this.vy *= drag
    this.vz *= drag
    this.vx += (smoothstep(0.85, 1, 1 - this.x) - smoothstep(0.85, 1, this.x)) * 0.3 * dt // glass walls
    this.vz += (smoothstep(0.8, 1, 1 - this.z) - smoothstep(0.8, 1, this.z)) * 0.3 * dt // back wall, front glass
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.z = Math.min(1, Math.max(0, this.z + this.vz * dt))
    if (this.y < 0.1) {
      this.y = 0.1 // resting on the floor of the tank
      this.vy = 0
    }
    this.x = Math.min(0.97, Math.max(0.03, this.x))
    // The bell leans into the current and steers back toward the middle.
    const lean = Math.max(-0.5, Math.min(0.5, cur * 4 + (0.5 - this.x) * 0.6))
    this.tilt += (lean - this.tilt) * (1 - Math.exp(-dt / 0.8))
    const leanZ = Math.max(-0.6, Math.min(0.6, curZ * 4 + (0.5 - this.z) * 0.8))
    this.pitch += (leanZ - this.pitch) * (1 - Math.exp(-dt / 0.8))

    // Tentacles trail behind the motion and whip on each stroke.
    const sway = this.trail.step(Math.max(-1, Math.min(1, -this.vx * 6 - this.vy * 0.8 * Math.sin(this.tilt) * 4)), dt)

    this.flash *= Math.exp(-dt / 1.1)
    const light = Math.max(0, Math.min(1.5, i.glow * (0.45 + 0.55 * this.flash) + i.glowCv / 10))

    // Feeding grows the bell; unfed it slowly settles back to adult size.
    if (i.feedPatched) this.size += dt * (Math.min(1, i.feed / 4) * 0.05 - 0.006)
    else this.size += (0.5 - this.size) * dt * 0.02
    this.size = Math.min(1, Math.max(0.15, this.size))

    o.gate = this.stroking ? 10 : 0
    o.sway = Math.max(-5, Math.min(5, sway * 5))
    o.grow = this.size * 10
    o.light = Math.min(10, light * 10)

    led[VS.action] = this.c
    led[VS.x] = this.x
    led[VS.y] = this.y
    led[VS.tilt] = this.tilt
    led[VS.glow] = light
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.grow] = this.size
    led[VS.sway] = sway
    led[VS.wilt] = 0
    led[VS.gate] = this.stroking ? 1 : 0
    led[JELLY_Z] = this.z
    led[JELLY_PITCH] = this.pitch
  }
}
