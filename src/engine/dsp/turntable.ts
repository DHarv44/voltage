import type { ModuleSpec } from '../../modules/types'
import { TTL } from '../../modules/specs/turntable'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { BattleRecord } from './battleRecord'
import { Schmitt } from './cores'
import { TAU } from './util'

const MAX_SECONDS = 60
/** The record is cut at 33⅓ rpm: one revolution holds 1.8 s of audio. */
const REV_SEC = 60 / (100 / 3)
const RPS_33 = 1 / REV_SEC
const RPS_45 = 45 / 60
/** Direct-drive motor torque (time constant to speed) and hand grip (slipmat). */
const MOTOR_TAU = 0.15
const GRIP_TAU = 0.002
/** Samples of the factory record pressed per engine sample. */
const PRESS_RATE = 8

/** Direct-drive turntable with a scratchable record. The platter is a flywheel:
 *  the motor pulls it toward speed, the brake (motor off) slows it, and a hand
 *  on the record overrides both. Audio is read from the groove at the platter's
 *  speed, reversed when it turns backwards, and — as with a magnetic cartridge,
 *  whose output follows stylus velocity — quieter the slower it moves. */
export class TurntableDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iStart = this.ii('start')
  private readonly iCut = this.ii('cut')
  private readonly iSpeed = this.ii('speed')
  private readonly pRpm = this.pi('rpm')
  private readonly pPitch = this.pi('pitch')
  private readonly pBrake = this.pi('brake')
  private readonly pWear = this.pi('wear')
  private readonly pLevel = this.pi('level')

  private buf: Float32Array
  private len = 0
  private rate: number
  private press: BattleRecord | null
  private recording = false
  private motor = true
  private theta = 0
  private omega = RPS_33
  private held = false
  private hand = 0
  private handOffset = 0
  private cutBtn = false
  private cutGain = 1
  private crackle = 0
  private rumblePh = 0
  private readonly start = new Schmitt()
  private readonly dt: number
  private readonly grip: number
  private readonly motorK: number
  private readonly fader: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.buf = new Float32Array(MAX_SECONDS * fs)
    this.rate = fs
    this.press = new BattleRecord(fs)
    this.dt = 1 / fs
    this.grip = 1 - Math.exp(-1 / (GRIP_TAU * fs))
    this.motorK = 1 - Math.exp(-1 / (MOTOR_TAU * fs))
    this.fader = 1 - Math.exp(-1 / (0.001 * fs))
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'hand') {
      if (ev.down && !this.held) this.handOffset = this.theta - ev.x // grab without a jump
      this.held = ev.down
      this.hand = ev.x + this.handOffset
    } else if (ev.kind === 'button') {
      if (ev.name === 'cut') this.cutBtn = ev.down
      else if (ev.down && ev.name === 'start') this.motor = !this.motor
      else if (ev.down && ev.name === 'rec') this.toggleRec()
    }
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot !== 0) return
    if (data.length > this.buf.length) this.buf = new Float32Array(data.length)
    this.buf.set(data)
    this.len = data.length
    this.rate = rate
    this.press = null
    this.recording = false
    this.theta = 0
  }

  dumpBuffer(): { rate: number; data: Float32Array } | null {
    return this.len ? { rate: this.rate, data: this.buf.slice(0, this.len) } : null
  }

  private toggleRec(): void {
    if (this.recording) {
      this.recording = false
      this.theta = 0
      if (this.len) this.bufferOut.push({ slot: 0, rate: this.rate, data: this.buf.subarray(0, this.len) })
    } else {
      this.recording = true
      this.press = null
      this.len = 0
      this.rate = this.fs
    }
  }

  /** 4-point Hermite read from the groove, wrapping (a locked groove). */
  private read(pos: number): number {
    const n = this.len
    const i = Math.floor(pos)
    const f = pos - i
    const b = this.buf
    const i1 = ((i % n) + n) % n
    const i0 = i1 === 0 ? n - 1 : i1 - 1
    const i2 = i1 + 1 >= n ? i1 + 1 - n : i1 + 1
    const i3 = i2 + 1 >= n ? i2 + 1 - n : i2 + 1
    const y0 = b[i0]
    const y1 = b[i1]
    const y2 = b[i2]
    const y3 = b[i3]
    const c1 = 0.5 * (y2 - y0)
    const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3
    const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2)
    return ((c3 * f + c2) * f + c1) * f + y1
  }

  tick(): void {
    const x = this.in
    const p = this.p
    if (this.press) {
      for (let k = 0; k < PRESS_RATE && !this.press.done; k++) this.buf[this.len++] = this.press.next()
      if (this.press.done) this.press = null
    }
    if (this.start.rise(x[this.iStart])) this.motor = !this.motor

    if (this.recording) {
      this.buf[this.len++] = x[this.iIn] / 5
      if (this.len >= this.buf.length) this.toggleRec()
    }

    // Platter: hand, motor or brake.
    const before = this.theta
    if (this.held) {
      this.theta += (this.hand - this.theta) * this.grip
      this.omega = (this.theta - before) * this.fs
    } else {
      if (this.motor) {
        const nominal = p[this.pRpm] >= 0.5 ? RPS_45 : RPS_33
        const target = nominal * (1 + p[this.pPitch] * 0.08 + x[this.iSpeed] * 0.08)
        this.omega += (target - this.omega) * this.motorK
      } else {
        this.omega *= Math.exp(-this.dt / p[this.pBrake])
        if (Math.abs(this.omega) < 1e-4) this.omega = 0
      }
      this.theta += this.omega * this.dt
    }
    const r = this.omega / RPS_33

    let y = 0
    if (this.len > 4 && !this.recording) {
      y = this.read(this.theta * REV_SEC * this.rate) * Math.min(2, Math.abs(r))
      // Surface noise: crackle and hiss ride on stylus speed; rumble on the motor.
      const wear = p[this.pWear]
      const moving = Math.min(2, Math.abs(r))
      if (this.rng.next() < wear * moving * 0.0004) this.crackle = (this.rng.next() - 0.5) * wear * 0.6
      this.crackle *= 0.82
      y += this.crackle + (this.rng.next() - 0.5) * wear * 0.006 * moving
      if (this.motor) {
        this.rumblePh = (this.rumblePh + 28 * this.dt) % 1
        y += Math.sin(TAU * this.rumblePh) * wear * 0.004
      }
    }
    const cut = this.cutBtn || x[this.iCut] > 1
    this.cutGain += ((cut ? 0 : 1) - this.cutGain) * this.fader

    const o = this.out
    o[0] = y * 5 * p[this.pLevel] * this.cutGain
    o[1] = Math.max(-10, Math.min(10, r * 5))
    const frac = this.theta - Math.floor(this.theta)
    const span = this.len ? this.len / this.rate / REV_SEC : 1
    const pos = (((this.theta / span) % 1) + 1) % 1
    o[2] = pos * 10
    o[3] = frac < 0.5 ? 10 : 0

    const led = this.led
    led[TTL.angle] = frac
    led[TTL.motor] = this.motor ? 1 : 0
    led[TTL.rec] = this.recording ? 1 : 0
    led[TTL.speed] = r
    led[TTL.pos] = pos
    led[TTL.held] = this.held ? 1 : 0
    led[TTL.pressing] = this.press ? 1 : 0
  }
}
