import { REEF, REEF_PASS_S, VS } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { hueOf, Wander, type Creature, type CreatureInput, type CreatureOutput } from './creature'

const TAU = Math.PI * 2
const SPREAD = 0.3
/** A finger's scare lasts this long (s). */
const SCARE_S = 0.6

/** A coral reef in the shallows. A school of fish mills round it (the screen
 *  swims each fish; the engine says where the school heads and when it turns
 *  as one), the swell surges back and forth through the fans and the
 *  anemone, and the coral's polyps open to feed. Every so often a barracuda
 *  cruises past and the school scatters. RATE: the swell's pace and how often
 *  things happen; TRIG: the barracuda; FEED: plankton (polyps open); MOVE:
 *  pushes the surge. GATE: the school turning, the barracuda arriving;
 *  MOTION: the surge; STATE: polyps open; LIGHT: sun flickering through the
 *  waves; DEPTH: how near the school is. Touch: tap to scare them, drag to
 *  lead them. */
export class Reef implements Creature {
  private x = 0.5
  private y = 0.55
  private z = 0.5
  private readonly wx: Wander
  private readonly wy: Wander
  private readonly wz: Wander
  private readonly swell: Wander
  private spread = SPREAD
  private panic = 0
  private pass = -1
  private bdir = 1
  private by = 0.5
  private bx = 0
  private scare = 0
  private sx = 0.5
  private sy = 0.5
  private surgePh = 0
  private polyps = 0.3
  private turns = 0
  private turnDir = 1
  private gate = 0
  private t = 0

  constructor(private readonly rng: Rng) {
    this.wx = new Wander(rng, 0.2, 0.3)
    this.wy = new Wander(rng, 0.25, 0.2)
    this.wz = new Wander(rng, 0.15, 0.25)
    this.swell = new Wander(rng, 0.1, 0.2)
  }

  /** A calm morning on the reef. */
  reset(): void {
    this.x = 0.5
    this.y = 0.55
    this.z = 0.5
    this.spread = SPREAD
    this.panic = this.scare = this.surgePh = this.gate = 0
    this.pass = -1
    this.polyps = 0.3
    this.wx.v = this.wy.v = this.wz.v = this.swell.v = 0
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    const rng = this.rng
    const tc = i.touch
    this.t += dt
    // the swell: a slow surge back and forth, now stronger, now weaker
    this.surgePh = (this.surgePh + dt * (0.05 + i.rate * 0.2)) % 1
    const surge = Math.max(-1, Math.min(1, Math.sin(TAU * this.surgePh) * (0.65 + this.swell.step(dt) * 0.5) + i.move * 0.1))

    // where the school heads: round the reef, or after a finger
    let gx = 0.5 + this.wx.step(dt) * 0.3
    let gy = 0.55 + this.wy.step(dt) * 0.2
    if (tc.touching && !tc.tap) {
      gx = tc.x
      gy = tc.y
    } else if (i.steer) {
      gx = i.sx
      gy = i.sy
    }
    const k = 1 - Math.exp(-dt / 2)
    this.x += (Math.max(0.15, Math.min(0.85, gx)) - this.x) * k
    this.y += (Math.max(0.3, Math.min(0.85, gy)) - this.y) * k
    this.z += (Math.max(0, Math.min(1, 0.5 + this.wz.step(dt) * 0.45)) - this.z) * k

    // the school wheels round as one now and then (with CLK, on the bar)
    if (i.bar || (!i.clocked && rng.next() < dt * i.rate * 0.3)) {
      this.turns++
      this.turnDir = rng.next() < 0.5 ? -1 : 1
      this.gate = 0.012
    }
    // the barracuda: across the reef at the school's height
    if (this.pass < 0 && (i.trig || rng.next() < dt * i.rate * 0.015)) {
      this.pass = 0
      this.bdir = rng.next() < 0.5 ? -1 : 1
      this.by = this.y
      this.gate = 0.012
    }
    if (this.pass >= 0) {
      this.pass += dt
      const u = this.pass / REEF_PASS_S
      this.bx = this.bdir > 0 ? -0.2 + u * 1.4 : 1.2 - u * 1.4
      this.panic = Math.max(this.panic, 1 - Math.abs(this.bx - this.x) / 0.3)
      if (this.pass > REEF_PASS_S) this.pass = -1
    }
    if (tc.tap) {
      this.scare = SCARE_S
      this.sx = tc.x
      this.sy = tc.y
      this.panic = 1
      this.gate = 0.012
    }
    this.scare = Math.max(0, this.scare - dt)
    this.panic *= Math.exp(-dt / 1.2)
    this.gate = Math.max(0, this.gate - dt)
    // frightened fish bunch up tight (a bait ball); calm ones loosen
    this.spread += (SPREAD * (1 - this.panic * 0.45) - this.spread) * (1 - Math.exp(-dt / 0.6))
    // plankton on the current opens the polyps
    const food = i.feedPatched ? Math.min(1, i.feed / 5) : 0.35
    this.polyps += (food - this.polyps) * (1 - Math.exp(-dt / 3))
    // CLK: the polyps flinch shut a little on every beat and open again
    const polyps = Math.max(0, this.polyps - i.pulse * 0.35)

    // sun through the waves: a restless flicker
    const shimmer = 0.5 + 0.25 * Math.sin(TAU * 0.7 * this.t) + 0.25 * Math.sin(TAU * 1.13 * this.t + 1)
    const light = Math.max(0, Math.min(1.5, i.glow * (0.65 + 0.35 * shimmer) + i.glowCv / 10))
    o.gate = this.gate > 0 ? 10 : 0
    o.sway = surge * 5
    o.grow = this.polyps * 10
    o.light = Math.min(10, light * 10)
    o.depth = this.z * 10
    led[VS.action] = this.panic
    led[VS.x] = this.x
    led[VS.y] = this.y
    led[VS.glow] = light
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.sway] = surge
    led[VS.grow] = polyps
    led[VS.gate] = this.gate > 0 ? 1 : 0
    led[REEF.z] = this.z
    led[REEF.spread] = this.spread
    led[REEF.panic] = this.panic
    led[REEF.bx] = this.bx
    led[REEF.by] = this.by
    led[REEF.pass] = this.pass
    led[REEF.bdir] = this.bdir
    led[REEF.sx] = this.sx
    led[REEF.sy] = this.sy
    led[REEF.scare] = this.scare
    led[REEF.surge] = surge
    led[REEF.polyps] = polyps
    led[REEF.turns] = this.turns
    led[REEF.turnDir] = this.turnDir
  }
}
