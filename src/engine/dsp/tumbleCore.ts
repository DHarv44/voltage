import type { Rng } from './util'

/** The drum's circumradius is 1; a ball's radius. */
export const TUMBLE_R = 0.075
/** Wall friction (Coulomb): what carries the balls up the turning wall. */
const MU = 0.35
/** Hits softer than this (units/s) are a ball resting or rolling: no note. */
const REST = 0.35
/** The motor brings the drum back to its speed with this time constant (s). */
const MOTOR = 0.4
const TAU = Math.PI * 2

export class Ball {
  x = 0
  y = 0
  vx = 0
  vy = 0
}

/** Balls in a spinning polygon drum: real 2D rigid-wall contact. Each wall
 *  moves with the drum (v = ω × r at the contact), the bounce keeps `e` of
 *  the normal speed, Coulomb friction drags the ball along the wall, and the
 *  balls collide with each other. Every hard enough wall hit calls `onHit`
 *  (set once; no allocation per step). Used by TUMBLER and SKETCHBOOK. */
export class TumbleCore {
  readonly balls: Ball[]
  angle = 0
  omega = 0
  /** Spun by hand (rad/s) while held; NaN = the motor drives it. */
  hand = Number.NaN
  onHit: (wall: number, speed: number) => void = () => {}

  constructor(
    count: number,
    private readonly rng: Rng,
  ) {
    this.startY = new Float64Array(count)
    this.balls = Array.from({ length: count }, (_, i) => {
      const b = new Ball()
      b.x = (i - (count - 1) / 2) * 0.25
      b.y = 0.2 + rng.next() * 0.3
      this.startY[i] = b.y
      return b
    })
  }
  private readonly startY: Float64Array

  /** Back to how it began: the drum square, the balls where they started, at rest. */
  reset(): void {
    const n = this.balls.length
    for (let i = 0; i < n; i++) {
      const b = this.balls[i]
      b.x = (i - (n - 1) / 2) * 0.25
      b.y = this.startY[i]
      b.vx = b.vy = 0
    }
    this.angle = 0
    this.omega = 0
  }

  /** Throw the first `count` balls upward. */
  kick(count: number, force = 1): void {
    for (let i = 0; i < count; i++) {
      const b = this.balls[i]
      const a = Math.PI / 2 + (this.rng.next() - 0.5) * 2
      const s = force * (2.2 + this.rng.next() * 1.2)
      b.vx += Math.cos(a) * s
      b.vy += Math.sin(a) * s
    }
  }

  /** Advance `dt` s: a drum of `sides` turning toward `speed` (rad/s),
   *  gravity `g`, restitution `e`, `count` balls in play. */
  step(dt: number, sides: number, speed: number, g: number, e: number, count: number): void {
    this.omega = Number.isNaN(this.hand) ? this.omega + (speed - this.omega) * (dt / MOTOR) : this.hand
    this.angle = (this.angle + this.omega * dt) % TAU
    const apothem = Math.cos(Math.PI / sides) // centre to each wall
    const w = this.omega
    const R = TUMBLE_R
    for (let i = 0; i < count; i++) {
      const b = this.balls[i]
      b.vy -= g * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      for (let k = 0; k < sides; k++) {
        // wall k's outward normal
        const phi = this.angle + (TAU * (k + 0.5)) / sides
        const nx = Math.cos(phi)
        const ny = Math.sin(phi)
        const s = b.x * nx + b.y * ny
        if (s <= apothem - R) continue
        // push back inside, then collide with the moving wall at the contact
        b.x -= nx * (s - apothem + R)
        b.y -= ny * (s - apothem + R)
        const cx = b.x + nx * R
        const cy = b.y + ny * R
        const wx = -w * cy
        const wy = w * cx
        const rx = b.vx - wx
        const ry = b.vy - wy
        const vn = rx * nx + ry * ny
        if (vn <= 0) continue
        const vt = -rx * ny + ry * nx
        const dvt = Math.min(Math.abs(vt), MU * (1 + e) * vn) * Math.sign(vt)
        const nvn = -e * vn
        const nvt = vt - dvt
        b.vx = wx + nvn * nx - nvt * ny
        b.vy = wy + nvn * ny + nvt * nx
        if (vn > REST) this.onHit(k, vn)
      }
    }
    // balls against each other (equal masses)
    for (let i = 0; i < count; i++)
      for (let j = i + 1; j < count; j++) {
        const a = this.balls[i]
        const c = this.balls[j]
        const dx = c.x - a.x
        const dy = c.y - a.y
        const d = Math.hypot(dx, dy)
        if (d >= 2 * R || d === 0) continue
        const nx = dx / d
        const ny = dy / d
        const push = (2 * R - d) / 2
        a.x -= nx * push
        a.y -= ny * push
        c.x += nx * push
        c.y += ny * push
        const vn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny
        if (vn <= 0) continue
        const j2 = ((1 + e) * vn) / 2
        a.vx -= j2 * nx
        a.vy -= j2 * ny
        c.vx += j2 * nx
        c.vy += j2 * ny
      }
  }
}
