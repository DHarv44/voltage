import type { ModuleSpec } from '../../modules/types'
import { TUMBLER_BALLS, TUMBLERL } from '../../modules/specs/tumbler'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { SCALES } from './shapers'

/** Physics at control rate: every CTRL samples (≈3 kHz). */
const CTRL = 16
/** The drum's circumradius is 1; a ball's radius; gravity (units/s²). */
const R = 0.075
const G = 4
/** Wall friction (Coulomb): what carries the balls up the turning wall. */
const MU = 0.35
/** Hits softer than this (units/s) are a ball resting or rolling: no note. */
const REST = 0.35
/** The motor brings the drum back to SPIN with this time constant (s). */
const MOTOR = 0.4
const TRIG_S = 0.005
/** A new note drops a held gate for this long, so envelopes retrigger. */
const REGATE_S = 0.002
const TAU = Math.PI * 2

class Ball {
  x = 0
  y = 0
  vx = 0
  vy = 0
}

/** Balls in a spinning polygon drum (see the spec). Real 2D rigid-wall
 *  contact: each wall moves with the drum (v = ω × r at the contact), the
 *  bounce keeps `e` of the normal speed, Coulomb friction drags the ball along
 *  the wall, and balls collide with each other. */
export class TumblerDsp extends Dsp {
  private readonly iKick = this.ii('kick')
  private readonly iSpin = this.ii('spin')
  private readonly iGrav = this.ii('grav')
  private readonly pSides = this.pi('sides')
  private readonly pSpeed = this.pi('speed')
  private readonly pGravity = this.pi('gravity')
  private readonly pBounce = this.pi('bounce')
  private readonly pBalls = this.pi('balls')
  private readonly pScale = this.pi('scale')
  private readonly pOct = this.pi('oct')
  private readonly pLen = this.pi('len')
  private readonly balls: Ball[]
  private readonly kick = new Schmitt()
  private angle = 0
  private omega = 0
  /** Spun by hand (rad/s) while held; NaN = the motor drives it. */
  private hand = Number.NaN
  private n = 0
  private pitch = 0
  private vel = 0
  private gate = 0
  private regate = 0
  private trig = 0
  private readonly dt: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.dt = CTRL / fs
    this.balls = Array.from({ length: TUMBLER_BALLS }, (_, i) => {
      const b = new Ball()
      b.x = (i - 1.5) * 0.25
      b.y = 0.2 + this.rng.next() * 0.3
      return b
    })
  }

  /** Drag on the drum: x = how fast the hand turns it (rad/s); click = kick. */
  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'spin') this.hand = ev.down ? ev.x : Number.NaN
    else if (ev.name === 'kick' && ev.down) this.throwBalls(1)
  }

  private throwBalls(force: number): void {
    const count = Math.round(this.p[this.pBalls])
    for (let i = 0; i < count; i++) {
      const b = this.balls[i]
      const a = Math.PI / 2 + (this.rng.next() - 0.5) * 2
      const s = force * (2.2 + this.rng.next() * 1.2)
      b.vx += Math.cos(a) * s
      b.vy += Math.sin(a) * s
    }
  }

  /** Wall k sounds: its note in the scale (wrapping up octaves), held on PITCH. */
  private hit(wall: number, speed: number): void {
    const scale = SCALES[Math.round(this.p[this.pScale])] ?? SCALES[0]
    const semis = scale[wall % scale.length] + 12 * Math.floor(wall / scale.length) + 12 * Math.round(this.p[this.pOct])
    this.pitch = semis / 12
    this.vel = Math.min(10, speed * 2.5)
    if (this.gate > 0) this.regate = Math.round(REGATE_S * this.fs)
    this.gate = Math.round(this.p[this.pLen] * this.fs)
    this.trig = Math.round(TRIG_S * this.fs)
    this.led[TUMBLERL.flash + wall] = Math.min(1, 0.3 + speed / 3)
  }

  private step(): void {
    const p = this.p
    const dt = this.dt
    const sides = Math.round(p[this.pSides])
    const count = Math.round(p[this.pBalls])
    const e = p[this.pBounce]
    const g = G * p[this.pGravity] * Math.max(0, 1 + this.in[this.iGrav] / 5)
    if (this.kick.rise(this.in[this.iKick])) this.throwBalls(1)

    // the drum: by hand, or the motor easing it to SPIN (+ CV, 1 rev/s per 5 V)
    const target = (p[this.pSpeed] + this.in[this.iSpin] / 5) * TAU
    this.omega = Number.isNaN(this.hand) ? this.omega + (target - this.omega) * (dt / MOTOR) : this.hand
    this.angle = (this.angle + this.omega * dt) % TAU
    const apothem = Math.cos(Math.PI / sides) // centre to each wall
    const w = this.omega

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
        if (vn > REST) this.hit(k, vn)
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

  tick(): void {
    if (++this.n >= CTRL) {
      this.n = 0
      this.step()
      const count = Math.round(this.p[this.pBalls])
      this.led[TUMBLERL.angle] = this.angle / TAU
      for (let k = 0; k < this.led.length - TUMBLERL.flash; k++) this.led[TUMBLERL.flash + k] *= 0.999 // walls glow, then fade (~⅓ s)
      for (let i = 0; i < TUMBLER_BALLS; i++) {
        this.led[TUMBLERL.pos + i * 2] = i < count ? (this.balls[i].x + 1) / 2 : -1
        this.led[TUMBLERL.pos + i * 2 + 1] = (this.balls[i].y + 1) / 2
      }
    }
    const o = this.out
    o[0] = this.pitch
    o[1] = this.regate > 0 ? 0 : this.gate > 0 ? 10 : 0
    o[2] = this.trig > 0 ? 10 : 0
    o[3] = this.vel
    if (this.regate > 0) this.regate--
    else if (this.gate > 0) this.gate--
    if (this.trig > 0) this.trig--
  }
}
