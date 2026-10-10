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
  /** CLK: a beat arrived this tick; which beat it is (0, 1, 2, 3, 0… so
   *  `bar` is beat 0 of four); `pulse` jumps to 1 on each beat and dies away
   *  (for things that throb in time). All quiet with CLK unpatched. */
  beat: boolean
  bar: boolean
  pulse: number
  /** CLK is patched (scenes that keep their own time hand it to the clock). */
  clocked: boolean
  /** X / Y: a point to steer the scene's creature toward (0..1 across and up;
   *  −5 V … +5 V on the jacks, 0 V the middle). `steer` while either is patched. */
  steer: boolean
  sx: number
  sy: number
}

/** A beat's pulse dies away over this long (s). */
export const PULSE_S = 0.14

/** What a creature drives: its output voltages (DEPTH 0–10 V: how near, or
 *  each scene's nearest equivalent). State goes to `led`. */
export interface CreatureOutput {
  gate: number
  sway: number
  grow: number
  light: number
  depth: number
}

export interface Creature {
  step(i: CreatureInput, o: CreatureOutput, led: Float32Array): void
  /** RST: start the scene over, as when it was first put in the tank (no
   *  allocation: it runs on the audio thread). */
  reset(): void
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

/** Steer a position toward the X / Y point (when patched), easing over `tau` s. */
export const steerTo = (v: number, goal: number, dt: number, tau: number): number => v + (goal - v) * (1 - Math.exp(-dt / tau))

/** Volts on a HUE input: each octave walks once round the colour wheel, so a note
 *  always has the same colour. */
export const hueOf = (knob: number, volts: number): number => {
  const h = knob + volts
  return h - Math.floor(h)
}
