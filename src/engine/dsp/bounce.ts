import type { ModuleSpec } from '../../modules/types'
import { BALLS, BOUNCEL } from '../../modules/specs/bounce'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'

const CTRL = 16
/** Box is 1.6 wide, 1 tall (matches the drawn surface); ball radius. */
const BOX_W = 1.6
const R = 0.04
const G = 2.6
const GATE_S = 0.005
/** Impacts slower than this settle the ball instead (no endless buzz). */
const REST = 0.06

class Ball {
  x = 0
  y = 0
  vx = 0
  vy = 0
  held = false
  gate = 0
}

/** Bouncing balls (see the spec). */
export class BounceDsp extends Dsp {
  private readonly iKick = this.ii('kick')
  private readonly iGrav = this.ii('grav')
  private readonly iTilt = this.ii('tilt')
  private readonly pBalls = this.pi('balls')
  private readonly pGravity = this.pi('gravity')
  private readonly pBounce = this.pi('bounce')
  private readonly pKick = this.pi('kickf')
  private readonly balls: Ball[]
  private readonly kick = new Schmitt()
  private grabbed = -1
  private n = 0
  private vel = 0
  private any = 0
  private readonly dt: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.dt = CTRL / fs
    this.balls = Array.from({ length: BALLS }, (_, i) => {
      const b = new Ball()
      b.x = 0.25 + i * 0.35
      b.y = 0.55 + this.rng.next() * 0.4
      return b
    })
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    const count = Math.round(this.p[this.pBalls])
    if (ev.name === 'grab' && ev.down) {
      // pick up the nearest ball (or keep holding the one we have)
      if (this.grabbed < 0) {
        let best = 0
        for (let i = 1; i < count; i++)
          if (Math.hypot(this.balls[i].x - ev.x, this.balls[i].y - ev.y) < Math.hypot(this.balls[best].x - ev.x, this.balls[best].y - ev.y)) best = i
        this.grabbed = best
      }
      const b = this.balls[this.grabbed]
      b.held = true
      b.x = Math.min(BOX_W - R, Math.max(R, ev.x))
      b.y = Math.min(1 - R, Math.max(R, ev.y))
    } else if (ev.name === 'throw' && this.grabbed >= 0) {
      const b = this.balls[this.grabbed]
      b.held = false
      b.vx = ev.x
      b.vy = ev.y
      this.grabbed = -1
    }
  }

  private step(): void {
    const p = this.p
    const count = Math.round(p[this.pBalls])
    const g = G * p[this.pGravity] * Math.max(0, 1 + this.in[this.iGrav] / 5)
    const tilt = Math.max(-1, Math.min(1, this.in[this.iTilt] / 5))
    const e = p[this.pBounce]
    const dt = this.dt
    if (this.kick.rise(this.in[this.iKick]))
      for (let i = 0; i < count; i++) {
        const b = this.balls[i]
        b.vy += p[this.pKick] * 3 * (0.7 + this.rng.next() * 0.6)
        b.vx += (this.rng.next() - 0.5) * p[this.pKick] * 2
      }
    for (let i = 0; i < count; i++) {
      const b = this.balls[i]
      if (b.held) continue
      b.vx += g * tilt * 0.6 * dt
      b.vy -= g * Math.sqrt(1 - tilt * tilt * 0.36) * dt
      b.vx *= 1 - 0.05 * dt // air
      b.x += b.vx * dt
      b.y += b.vy * dt
      let impact = 0
      if (b.y < R) {
        b.y = R
        impact = -b.vy
        b.vy = impact < REST ? 0 : impact * e
        b.vx *= 0.98 // a little floor friction
      } else if (b.y > 1 - R) {
        b.y = 1 - R
        impact = b.vy
        b.vy = -b.vy * e
      }
      if (b.x < R || b.x > BOX_W - R) {
        b.x = b.x < R ? R : BOX_W - R
        impact = Math.max(impact, Math.abs(b.vx))
        b.vx = -b.vx * e
      }
      if (impact > REST) {
        b.gate = Math.round(GATE_S * this.fs)
        this.vel = Math.min(10, impact * 3)
        this.any = Math.round(GATE_S * this.fs)
        this.led[BOUNCEL.flash + i] = Math.min(1, impact)
      }
    }
  }

  tick(): void {
    if (++this.n >= CTRL) {
      this.n = 0
      this.step()
    }
    const o = this.out
    const count = Math.round(this.p[this.pBalls])
    for (let i = 0; i < BALLS; i++) {
      const b = this.balls[i]
      o[i] = i < count && b.gate > 0 ? 10 : 0
      if (b.gate > 0) b.gate--
      this.led[BOUNCEL.pos + i * 2] = i < count ? b.x / BOX_W : -1
      this.led[BOUNCEL.pos + i * 2 + 1] = b.y
      this.led[BOUNCEL.flash + i] *= 0.9995
    }
    o[BALLS] = this.any > 0 ? 10 : 0
    if (this.any > 0) this.any--
    o[BALLS + 1] = this.vel
    o[BALLS + 2] = (this.balls[0].x / BOX_W) * 10
    o[BALLS + 3] = this.balls[0].y * 10
  }
}
