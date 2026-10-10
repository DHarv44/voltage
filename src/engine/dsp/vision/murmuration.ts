import { MUR, VS } from '../../../modules/specs/vision'
import type { Rng } from '../util'
import { hueOf, smoothstep, Wander, type Creature, type CreatureInput, type CreatureOutput } from './creature'

/** One evening (s), and how long the birds stay down before the next one. */
const DUSK_S = 300
const ROOST_S = 25
/** How long a falcon's stoop lasts (s). */
const STOOP_S = 2.5
/** The flock's usual radius (scene units). */
const SPREAD = 0.42

/** Starlings over a reed bed at dusk. The engine flies the flock as a whole:
 *  where it heads, how tight it is, the turning waves that ripple through it
 *  (RATE: how often), falcons diving into it, and the evening going dark until
 *  the birds pour down into the reeds to roost (then a new evening). The
 *  screen flies each bird (they only follow their neighbours), so the shapes
 *  are the flock's own. TRIG: a falcon stoops; FEED: cohesion (they pack
 *  tighter); MOVE: the wind. GATE: each turning wave and each stoop; MOTION:
 *  the flock swinging left/right; STATE: how dense; LIGHT: the light left;
 *  DEPTH: how near. Touch: tap to send the falcon there, drag to lead them. */
export class Murmuration implements Creature {
  private x = 0.5
  private y = 0.6
  private z = 0.5
  private vx = 0
  private readonly wx: Wander
  private readonly wy: Wander
  private readonly wz: Wander
  private spread = SPREAD
  private panic = 0
  private fx = 0.5
  private fy = 0.6
  private falcon = -1
  private waves = 0
  private waveDir = 1
  private gate = 0
  private dusk = 0
  private roosted = 0

  constructor(private readonly rng: Rng) {
    this.wx = new Wander(rng, 0.25, 0.35)
    this.wy = new Wander(rng, 0.3, 0.25)
    this.wz = new Wander(rng, 0.1, 0.25)
  }

  /** A new evening, the flock just up from the fields. */
  reset(): void {
    this.x = 0.5
    this.y = 0.6
    this.z = 0.5
    this.vx = this.panic = this.gate = this.dusk = this.roosted = 0
    this.spread = SPREAD
    this.falcon = -1
    this.wx.v = this.wy.v = this.wz.v = 0
  }

  private stoop(x: number, y: number): void {
    this.falcon = 0
    this.fx = x
    this.fy = y
    this.panic = 1
    this.gate = 0.012
  }

  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void {
    const dt = i.dt
    const tc = i.touch
    // the evening: the light goes, they sink to the reeds and roost, then it starts again
    if (this.dusk < 1) this.dusk = Math.min(1, this.dusk + dt / DUSK_S)
    else if ((this.roosted += dt) > ROOST_S) this.dusk = this.roosted = 0
    const roost = smoothstep(0.85, 1, this.dusk)
    const flying = roost < 0.5

    // where the flock heads: a slow wander over the reed bed (the wind leans it), or a finger
    let gx = 0.5 + this.wx.step(dt) * 0.35 + i.move * 0.04
    let gy = 0.6 + this.wy.step(dt) * 0.2
    if (tc.touching) {
      gx = tc.x
      gy = tc.y
    } else if (i.steer) {
      gx = i.sx
      gy = i.sy
    }
    gx = Math.max(0.1, Math.min(0.9, gx))
    gy = Math.max(0.25, Math.min(0.9, gy)) * (1 - roost) + 0.02 * roost
    const k = 1 - Math.exp(-dt / 1.6)
    const nx = this.x + (gx - this.x) * k
    this.vx += ((nx - this.x) / dt - this.vx) * (1 - Math.exp(-dt / 0.5))
    this.x = nx
    this.y += (gy - this.y) * k
    this.z += (Math.max(0, Math.min(1, 0.5 + this.wz.step(dt) * 0.45)) - this.z) * k

    // turning waves (more of them as the light goes, the show before the roost) and falcons
    // (with CLK patched the waves come on the bar instead, the show in time)
    const wave = i.bar || (!i.clocked && this.rng.next() < dt * i.rate * 0.6 * (1 + 2 * smoothstep(0.6, 0.85, this.dusk)))
    if (flying && wave) {
      this.waves++
      this.waveDir = this.rng.next() < 0.5 ? -1 : 1
      this.gate = 0.012
    }
    if (flying && (i.trig || this.rng.next() < dt * i.rate * 0.02)) this.stoop(this.x, this.y)
    if (flying && tc.tap) this.stoop(tc.x, tc.y)
    if (this.falcon >= 0 && (this.falcon += dt) > STOOP_S) this.falcon = -1
    this.panic *= Math.exp(-dt / 1.5)
    this.gate = Math.max(0, this.gate - dt)

    // a falcon blows the flock apart (a flash expansion); FEED packs them tighter
    const cohesion = i.feedPatched ? 1.4 - Math.min(1, i.feed / 5) * 0.9 : 1
    // the flock breathes out on every beat
    const goal = SPREAD * (1 + this.panic * 1.4 + i.pulse * 0.25) * cohesion * (1 - roost * 0.6)
    this.spread += (goal - this.spread) * (1 - Math.exp(-dt / 0.8))

    const light = Math.max(0, Math.min(1.5, i.glow * (1 - this.dusk * 0.85) + i.glowCv / 10))
    const sway = Math.max(-5, Math.min(5, this.vx * 40))
    const dense = Math.max(0, Math.min(1, (0.8 - this.spread) / 0.65))
    o.gate = this.gate > 0 ? 10 : 0
    o.sway = sway
    o.grow = dense * 10
    o.light = Math.min(10, light * 10)
    o.depth = this.z * 10
    led[VS.action] = this.panic
    led[VS.x] = this.x
    led[VS.y] = this.y
    led[VS.glow] = light
    led[VS.hue] = hueOf(i.hue, i.hueV)
    led[VS.sway] = sway / 5
    led[VS.grow] = dense
    led[VS.gate] = this.gate > 0 ? 1 : 0
    led[MUR.z] = this.z
    led[MUR.spread] = this.spread
    led[MUR.panic] = this.panic
    led[MUR.fx] = this.fx
    led[MUR.fy] = this.fy
    led[MUR.falcon] = this.falcon
    led[MUR.waves] = this.waves
    led[MUR.waveDir] = this.waveDir
    led[MUR.dusk] = this.dusk
  }
}
