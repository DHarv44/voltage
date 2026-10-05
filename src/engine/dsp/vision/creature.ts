import type { Rng } from '../util'

/** What a creature sees each control tick. */
export interface CreatureInput {
  dt: number
  /** A TRIG rising edge arrived since the last tick. */
  trig: boolean
  trigPatched: boolean
  /** TRIG is still high (a held gate: a sustained note). */
  held: boolean
  /** The glass is a touch screen. `tap`: a finger just landed this tick;
   *  `touching`: one is down; x/y: where, in the scene's own 0..1 space
   *  (the screen works it out through the camera); dx/dy: movement since the
   *  last tick (a drag). */
  touch: { tap: boolean; touching: boolean; x: number; y: number; dx: number; dy: number }
  /** Envelope of the FEED input in volts (0 when unpatched). */
  feed: number
  feedPatched: boolean
  glowCv: number
  hueV: number
  move: number
  rate: number
  hue: number
  glow: number
  /** COUNT knob 0..1 (see countOf): how many things the scene has. */
  count: number
  /** Menu settings (option indexes; see VISION_SETTINGS). */
  opts: { sky: number; trees: number; flora: number; bugs: number }
}

/** What a creature drives: its four output voltages. State goes to `led`. */
export interface CreatureOutput {
  gate: number
  sway: number
  grow: number
  light: number
}

export interface Creature {
  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void
}

/** Damped spring (second-order system): tentacles trailing, a stem in the wind. */
export class Spring2 {
  pos = 0
  vel = 0
  constructor(
    private readonly w: number,
    private readonly zeta: number,
  ) {}
  step(target: number, dt: number): number {
    const a = this.w * this.w * (target - this.pos) - 2 * this.zeta * this.w * this.vel
    this.vel += a * dt
    this.pos += this.vel * dt
    return this.pos
  }
}

/** Ornstein–Uhlenbeck wander: the slow, mean-reverting drift of water or wind. */
export class Wander {
  v = 0
  constructor(
    private readonly rng: Rng,
    private readonly pull: number,
    private readonly kick: number,
  ) {}
  step(dt: number): number {
    this.v += -this.v * this.pull * dt + this.rng.gauss() * this.kick * Math.sqrt(dt)
    return this.v
  }
}

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Volts on a HUE input: each octave walks once round the colour wheel, so a note
 *  always has the same colour. */
export const hueOf = (knob: number, volts: number): number => {
  const h = knob + volts
  return h - Math.floor(h)
}
