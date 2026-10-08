import type { ModuleSpec } from '../../modules/types'
import { CHAOSL } from '../../modules/specs/chaos'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { TAU } from './util'

const CTRL = 32
const GATE_S = 0.008
const G = 9.81

/** Double pendulum (equal arms and masses) and the Lorenz system, both
 *  integrated with RK4 at control rate. */
export class ChaosDsp extends Dsp {
  private readonly iKick = this.ii('kick')
  private readonly iRate = this.ii('rate')
  private readonly pMode = this.pi('mode')
  private readonly pRate = this.pi('rate')
  private readonly pEnergy = this.pi('energy')
  private readonly pDamp = this.pi('damp')
  /** Pendulum state: θ1, θ2, ω1, ω2. Lorenz state: x, y, z. */
  private readonly s = new Float64Array([2.2, 2.6, 0, 0])
  private readonly l = new Float64Array([1, 1, 20])
  private readonly k1 = new Float64Array(4)
  private readonly k2 = new Float64Array(4)
  private readonly k3 = new Float64Array(4)
  private readonly k4 = new Float64Array(4)
  private readonly tmp = new Float64Array(4)
  private readonly kick = new Schmitt()
  private readonly iRst = this.ii('rst')
  private readonly rst = new Schmitt()
  private gate = 0
  private lastWing = 1
  private lastTurns = 0
  private n = 0
  private readonly goal = new Float64Array(3)

  /** Equations of motion of the double pendulum (Lagrangian, m = l = 1). */
  private pend(s: Float64Array, d: Float64Array, damp: number): void {
    const t1 = s[0]
    const t2 = s[1]
    const w1 = s[2]
    const w2 = s[3]
    const dt = t1 - t2
    const den = 3 - Math.cos(2 * dt)
    d[0] = w1
    d[1] = w2
    d[2] = (-3 * G * Math.sin(t1) - G * Math.sin(t1 - 2 * t2) - 2 * Math.sin(dt) * (w2 * w2 + w1 * w1 * Math.cos(dt))) / den - damp * w1
    d[3] = (2 * Math.sin(dt) * (2 * w1 * w1 + 2 * G * Math.cos(t1) + w2 * w2 * Math.cos(dt))) / den - damp * w2
  }

  private lorenz(s: Float64Array, d: Float64Array, rho: number): void {
    d[0] = 10 * (s[1] - s[0])
    d[1] = s[0] * (rho - s[2]) - s[1]
    d[2] = s[0] * s[1] - (8 / 3) * s[2]
  }

  private rk4(state: Float64Array, n: number, h: number, f: (s: Float64Array, d: Float64Array) => void): void {
    const t = this.tmp
    f(state, this.k1)
    for (let i = 0; i < n; i++) t[i] = state[i] + (h / 2) * this.k1[i]
    f(t, this.k2)
    for (let i = 0; i < n; i++) t[i] = state[i] + (h / 2) * this.k2[i]
    f(t, this.k3)
    for (let i = 0; i < n; i++) t[i] = state[i] + h * this.k3[i]
    f(t, this.k4)
    for (let i = 0; i < n; i++) state[i] += (h / 6) * (this.k1[i] + 2 * this.k2[i] + 2 * this.k3[i] + this.k4[i])
  }

  private readonly pendF = (s: Float64Array, d: Float64Array) => this.pend(s, d, this.p[this.pDamp] * 0.3)
  private readonly lorF = (s: Float64Array, d: Float64Array) => this.lorenz(s, d, 15 + this.p[this.pEnergy] * 25)

  /** RST: back to the very same starting point. Chaos is deterministic, so
   *  the same "random" phrase plays again from here (until a KICK). */
  private restart(): void {
    this.s[0] = 2.2
    this.s[1] = 2.6
    this.s[2] = this.s[3] = 0
    this.l[0] = this.l[1] = 1
    this.l[2] = 20
    this.lastWing = 1
    this.lastTurns = 0
  }

  private step(dt: number): void {
    const p = this.p
    if (this.rst.rise(this.in[this.iRst])) this.restart()
    const h = dt * p[this.pRate] * Math.pow(2, this.in[this.iRate])
    const kicked = this.kick.rise(this.in[this.iKick])
    const g = this.goal
    if (p[this.pMode] < 0.5) {
      const s = this.s
      if (kicked) s[3] += (1 + p[this.pEnergy] * 8) * (this.rng.next() < 0.5 ? -1 : 1)
      // a sustaining hand: ENERGY keeps the swing from dying away under FRICTION
      const e = 0.5 * (2 * s[2] * s[2] + s[3] * s[3]) - G * (2 * Math.cos(s[0]) + Math.cos(s[1]))
      if (e < -15 + p[this.pEnergy] * 45) s[2] += 0.02 * Math.sign(s[2] || 1)
      this.rk4(s, 4, h * 2, this.pendF)
      const x = Math.sin(s[0]) + Math.sin(s[1])
      const y = -Math.cos(s[0]) - Math.cos(s[1])
      g[0] = x * 2.5
      g[1] = y * 2.5
      g[2] = Math.max(-5, Math.min(5, s[3] * 0.4))
      const turns = Math.floor((s[1] + Math.PI) / TAU) // outer arm passing the top
      if (turns !== this.lastTurns) this.fire()
      this.lastTurns = turns
      this.led[CHAOSL.x] = x / 2
      this.led[CHAOSL.y] = y / 2
    } else {
      const l = this.l
      if (kicked) l[0] += (this.rng.next() - 0.5) * 6
      this.rk4(l, 3, h, this.lorF)
      g[0] = (l[0] / 20) * 5
      g[1] = (l[1] / 27) * 5
      g[2] = ((l[2] - 25) / 25) * 5
      const wing = l[0] >= 0 ? 1 : -1
      if (wing !== this.lastWing) this.fire()
      this.lastWing = wing
      this.led[CHAOSL.x] = l[0] / 22
      this.led[CHAOSL.y] = -(l[2] - 25) / 28
    }
  }

  private fire(): void {
    this.gate = Math.round(GATE_S * this.fs)
    this.led[CHAOSL.flip] = 1
  }

  tick(): void {
    if (++this.n >= CTRL) {
      this.n = 0
      this.step(CTRL / this.fs)
    }
    const o = this.out
    for (let i = 0; i < 3; i++) o[i] += (this.goal[i] - o[i]) * 0.05
    o[3] = this.gate > 0 ? 10 : 0
    if (this.gate > 0) this.gate--
    this.led[CHAOSL.flip] *= 0.9995
  }

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.s[1] += this.rng.gauss() * 0.01 // every unit starts its own trajectory
  }
}
