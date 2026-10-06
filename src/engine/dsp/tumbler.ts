import type { ModuleSpec } from '../../modules/types'
import { TUMBLER_BALLS, TUMBLERL } from '../../modules/specs/tumbler'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { SCALES } from './shapers'
import { TumbleCore } from './tumbleCore'

/** Physics at control rate: every CTRL samples (≈3 kHz). */
const CTRL = 16
/** Gravity (units/s²) at GRAVITY 1. */
const G = 4
const TRIG_S = 0.005
/** A new note drops a held gate for this long, so envelopes retrigger. */
const REGATE_S = 0.002
const TAU = Math.PI * 2

/** Balls in a spinning polygon drum (see the spec and TumbleCore). Every wall
 *  hit plays that wall's note. */
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
  private readonly drum: TumbleCore
  private readonly kick = new Schmitt()
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
    this.drum = new TumbleCore(TUMBLER_BALLS, this.rng)
    this.drum.onHit = (wall, speed) => this.hit(wall, speed)
  }

  /** Drag on the drum: x = how fast the hand turns it (rad/s); click = kick. */
  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'spin') this.drum.hand = ev.down ? ev.x : Number.NaN
    else if (ev.name === 'kick' && ev.down) this.drum.kick(Math.round(this.p[this.pBalls]))
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

  tick(): void {
    if (++this.n >= CTRL) {
      this.n = 0
      const p = this.p
      const count = Math.round(p[this.pBalls])
      if (this.kick.rise(this.in[this.iKick])) this.drum.kick(count)
      // the drum turns toward SPIN (+ CV, 1 rev/s per 5 V)
      const speed = (p[this.pSpeed] + this.in[this.iSpin] / 5) * TAU
      const g = G * p[this.pGravity] * Math.max(0, 1 + this.in[this.iGrav] / 5)
      this.drum.step(this.dt, Math.round(p[this.pSides]), speed, g, p[this.pBounce], count)
      this.led[TUMBLERL.angle] = this.drum.angle / TAU
      for (let k = 0; k < this.led.length - TUMBLERL.flash; k++) this.led[TUMBLERL.flash + k] *= 0.999 // walls glow, then fade (~⅓ s)
      for (let i = 0; i < TUMBLER_BALLS; i++) {
        this.led[TUMBLERL.pos + i * 2] = i < count ? (this.drum.balls[i].x + 1) / 2 : -1
        this.led[TUMBLERL.pos + i * 2 + 1] = (this.drum.balls[i].y + 1) / 2
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
