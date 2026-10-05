import type { ModuleSpec } from '../../modules/types'
import { BOIDS, FLOCKL } from '../../modules/specs/flock'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { TAU } from './util'

const CTRL = 128
const VIEW = 0.18
const TOO_CLOSE = 0.05
const GATE_S = 0.01

/** Boids on a torus (Reynolds' three rules), stepped at control rate. */
export class FlockDsp extends Dsp {
  private readonly iTx = this.ii('tx')
  private readonly iTy = this.ii('ty')
  private readonly iScatter = this.ii('scatter')
  private readonly pCoh = this.pi('cohesion')
  private readonly pAlign = this.pi('align')
  private readonly pSep = this.pi('separate')
  private readonly pSpeed = this.pi('speed')
  private readonly x = new Float64Array(BOIDS)
  private readonly y = new Float64Array(BOIDS)
  private readonly vx = new Float64Array(BOIDS)
  private readonly vy = new Float64Array(BOIDS)
  private readonly scatter = new Schmitt()
  private fear = { x: 0, y: 0, t: 0 }
  private n = 0
  private head = 0
  private headRef = 0
  private turnClock = 0
  private turn = 0
  private readonly goal = new Float64Array(5)

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    for (let i = 0; i < BOIDS; i++) {
      this.x[i] = 0.3 + this.rng.next() * 0.4
      this.y[i] = 0.3 + this.rng.next() * 0.4
      const a = this.rng.next() * TAU
      this.vx[i] = Math.cos(a) * 0.1
      this.vy[i] = Math.sin(a) * 0.1
    }
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'scare' && ev.down) this.fear = { x: ev.x, y: ev.y, t: 0.6 }
  }

  /** Shortest signed distance on the wrap-around world. */
  private wrap(d: number): number {
    return d - Math.round(d)
  }

  private step(dt: number): void {
    const p = this.p
    if (this.scatter.rise(this.in[this.iScatter])) {
      let mx = 0
      let my = 0
      for (let i = 0; i < BOIDS; i++) {
        mx += this.x[i]
        my += this.y[i]
      }
      this.fear = { x: mx / BOIDS, y: my / BOIDS, t: 0.6 }
    }
    const vmax = p[this.pSpeed]
    const attract = this.patched[this.iTx] || this.patched[this.iTy]
    const tx = 0.5 + this.in[this.iTx] / 10
    const ty = 0.5 + this.in[this.iTy] / 10
    for (let i = 0; i < BOIDS; i++) {
      let cx = 0
      let cy = 0
      let ax = 0
      let ay = 0
      let sx = 0
      let sy = 0
      let n = 0
      for (let j = 0; j < BOIDS; j++) {
        if (i === j) continue
        const dx = this.wrap(this.x[j] - this.x[i])
        const dy = this.wrap(this.y[j] - this.y[i])
        const d = Math.hypot(dx, dy)
        if (d > VIEW) continue
        cx += dx
        cy += dy
        ax += this.vx[j]
        ay += this.vy[j]
        if (d < TOO_CLOSE && d > 0) {
          sx -= dx / d
          sy -= dy / d
        }
        n++
      }
      let fx = 0
      let fy = 0
      if (n) {
        fx += (cx / n) * p[this.pCoh] * 2 + (ax / n - this.vx[i]) * p[this.pAlign] * 2 + sx * p[this.pSep] * 0.05
        fy += (cy / n) * p[this.pCoh] * 2 + (ay / n - this.vy[i]) * p[this.pAlign] * 2 + sy * p[this.pSep] * 0.05
      }
      if (attract) {
        fx += this.wrap(tx - this.x[i]) * 0.8
        fy += this.wrap(ty - this.y[i]) * 0.8
      }
      if (this.fear.t > 0) {
        const dx = this.wrap(this.x[i] - this.fear.x)
        const dy = this.wrap(this.y[i] - this.fear.y)
        const d = Math.max(0.02, Math.hypot(dx, dy))
        fx += (dx / d / d) * 0.05
        fy += (dy / d / d) * 0.05
      }
      this.vx[i] += fx * dt * 4
      this.vy[i] += fy * dt * 4
      const v = Math.hypot(this.vx[i], this.vy[i]) || 1
      const s = Math.min(vmax * (this.fear.t > 0 ? 2.5 : 1), Math.max(vmax * 0.4, v))
      this.vx[i] = (this.vx[i] / v) * s
      this.vy[i] = (this.vy[i] / v) * s
      this.x[i] = (this.x[i] + this.vx[i] * dt + 1) % 1
      this.y[i] = (this.y[i] + this.vy[i] * dt + 1) % 1
    }
    this.fear.t = Math.max(0, this.fear.t - dt)

    // The flock as a whole (circular means, since the world wraps).
    let sxa = 0
    let cxa = 0
    let sya = 0
    let cya = 0
    let vx = 0
    let vy = 0
    for (let i = 0; i < BOIDS; i++) {
      sxa += Math.sin(TAU * this.x[i])
      cxa += Math.cos(TAU * this.x[i])
      sya += Math.sin(TAU * this.y[i])
      cya += Math.cos(TAU * this.y[i])
      vx += this.vx[i]
      vy += this.vy[i]
      const k = FLOCKL.boids + i * 3
      this.led[k] = this.x[i]
      this.led[k + 1] = this.y[i]
      this.led[k + 2] = Math.atan2(this.vy[i], this.vx[i])
    }
    const mx = ((Math.atan2(sxa, cxa) / TAU) + 1) % 1
    const my = ((Math.atan2(sya, cya) / TAU) + 1) % 1
    const spread = 1 - Math.hypot(sxa, cxa, sya, cya) / (BOIDS * Math.SQRT2)
    this.head = Math.atan2(vy, vx)
    const g = this.goal
    g[0] = mx * 10
    g[1] = my * 10
    g[2] = Math.min(10, spread * 14)
    g[3] = Math.min(10, (Math.hypot(vx, vy) / BOIDS / Math.max(0.01, vmax)) * 8)
    g[4] = ((this.head / TAU + 1) % 1) * 10
    // TURN: the flock's heading swung more than 60° in under half a second.
    this.turnClock += dt
    let dh = Math.abs(this.head - this.headRef)
    if (dh > Math.PI) dh = TAU - dh
    if (dh > Math.PI / 3) {
      if (this.turnClock < 0.5) this.turn = Math.round(GATE_S * this.fs)
      this.headRef = this.head
      this.turnClock = 0
    } else if (this.turnClock > 0.5) {
      this.headRef = this.head
      this.turnClock = 0
    }
  }

  tick(): void {
    if (++this.n >= CTRL) {
      this.n = 0
      this.step(CTRL / this.fs)
    }
    const o = this.out
    for (let i = 0; i < 4; i++) o[i] += (this.goal[i] - o[i]) * 0.002
    o[4] = this.goal[4]
    o[5] = this.turn > 0 ? 10 : 0
    if (this.turn > 0) this.turn--
  }
}
