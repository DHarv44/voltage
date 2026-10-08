import { MAELZEL_BELL_N, MZ_SWING, MZ_VOLTS, MZL } from '../../modules/specs/metronomes'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { BELL, CLACK, ClickVoice } from './clickVoice'
import { Schmitt } from './cores'

/** Friction on the swing (per second). */
const DAMP = 0.5
/** The escapement's push per tick (rad/s) that holds a full spring's swing at
 *  MZ_SWING against DAMP: each push adds J/ω of swing, friction takes about
 *  swing·DAMP·π/(2ω) per half swing. */
const KICK = (MZ_SWING * DAMP * Math.PI) / 2
/** A real pendulum swings slower the wider it goes (period ≈ T₀(1 + A²/16));
 *  the dial is right at the full swing, so a tired spring runs a touch fast. */
const DIAL = (1 + MZ_SWING ** 2 / 16 + (11 * MZ_SWING ** 4) / 3072) ** 2 * 1.0029 // (measured: the pushes and friction cost ~0.14%)
/** How hard a full PLANK draws the swings together (a share of the swing's
 *  own rate): two set up to ~2·PLANK·couple apart in tempo still lock. */
const PLANK = 0.03
/** Ticks a full winding lasts (a few minutes). */
const WINDING = 420
/** TILT's furthest from level, in radians at the escapement. */
const TILT_RAD = 0.26
const GATE_S = 0.02
const FLASH_DECAY = 0.9993

/** MAELZEL: a pendulum (angle θ, speed v) under gravity, friction and the
 *  plank it stands on (PLANK in: another pendulum's SWING, as the shared
 *  board's sway). Each time the rod passes the escapement point (the middle,
 *  or off it by TILT) it ticks and the spring gives it a push; a wound-down
 *  spring pushes less, the swing dies away and it stops. */
export class MaelzelDsp extends Dsp {
  private iPlank = this.ii('plank')
  private iRst = this.ii('rst')
  private oTick = this.oi('tick')
  private oBell = this.oi('bell')
  private oSwing = this.oi('swing')
  private oRst = this.oi('rsto')
  private oOut = this.oi('out')
  private P = { bpm: this.pi('bpm'), bell: this.pi('bell'), tilt: this.pi('tilt'), couple: this.pi('couple'), level: this.pi('level'), run: this.pi('run'), spring: this.pi('spring') }
  private readonly rst = new Schmitt()
  private readonly clack = new ClickVoice(this.fs)
  private readonly bellVoice = new ClickVoice(this.fs)
  /** Held aside, ready to be let go. */
  private theta = -MZ_SWING
  private v = 0
  private wound = 1
  private ticks = 0
  private tickGate = 0
  private bellGate = 0
  private wasRunning = false
  private rstOut = 0
  private winding = false
  private powered = false
  private prevPlank = 0

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'wind' && ev.down) this.winding = true
  }

  /** Pull the rod aside and let it go (it ticks a quarter swing later). */
  private release(): void {
    this.theta = -MZ_SWING
    this.v = 0
    this.ticks = 0
    this.rstOut = Math.round(0.003 * this.fs)
  }

  /** Powered up already swinging, at its own point in the swing (as if set
   *  going by hand): two on one plank start out of step. */
  private swinging(): void {
    const ph = this.rng.next() * Math.PI * 2
    this.theta = -MZ_SWING * Math.cos(ph)
    this.v = MZ_SWING * ((Math.PI * this.p[this.P.bpm]) / 60) * Math.sin(ph)
  }

  /** The shared plank: where the other pendulum is in its swing (its angle at
   *  PLANK in, its speed from how that's changing) draws this one's swing a
   *  little toward it, without speeding or slowing either: together they only
   *  settle in step, at the tempo between theirs. A partner barely swinging
   *  barely pulls. */
  private plank(w: number, dt: number): void {
    const io = this.in[this.iPlank] / MZ_VOLTS
    const so = -((io - this.prevPlank) / dt) / w
    this.prevPlank = io
    const s = -this.v / w
    const pull = PLANK * this.p[this.P.couple] * w * Math.min(1, Math.hypot(io, so) / MZ_SWING)
    const a = pull * Math.sin(Math.atan2(so, io) - Math.atan2(s, this.theta)) * dt
    // turn (θ, s) by a: the same swing, a touch further on (or back)
    const c = Math.cos(a)
    const n = Math.sin(a)
    const th = this.theta * c - s * n
    this.v = -w * (this.theta * n + s * c)
    this.theta = th
  }

  private strike(): void {
    const p = this.p
    const n = MAELZEL_BELL_N[Math.round(p[this.P.bell])] ?? 0
    const lvl = p[this.P.level]
    // tick and tock: the two pallets never sound quite alike
    this.clack.strike(CLACK, lvl, this.ticks % 2 === 0 ? 1 : 0.93)
    this.tickGate = Math.round(GATE_S * this.fs)
    this.led[MZL.tick] = 1
    if (n > 0 && this.ticks % n === 0) {
      this.bellVoice.strike(BELL, lvl * 0.6)
      this.bellGate = this.tickGate
      this.led[MZL.bell] = 1
    }
    this.led[MZL.beat] = n > 0 ? this.ticks % n : this.ticks % 2
    this.ticks++
    if (this.p[this.P.spring] < 0.5) this.wound = Math.max(0, this.wound - 1 / WINDING)
  }

  tick(): void {
    const { P, p, fs } = this
    const run = p[P.run] >= 0.5
    if (this.rst.rise(this.in[this.iRst])) this.release()
    else if (run && !this.wasRunning) {
      if (this.powered) this.release()
      else this.swinging()
    }
    this.powered = true
    this.wasRunning = run
    if (this.winding) {
      this.winding = false
      this.wound = 1
      // winding a stopped one sets it going again
      if (run && Math.abs(this.theta) < 0.05 && Math.abs(this.v) < 0.2) this.release()
    }
    const electric = p[P.spring] >= 0.5
    const drive = electric ? 1 : Math.min(1, this.wound * 4)

    if (!run) {
      // latched upright
      this.v = 0
      this.theta *= 0.999
    } else {
      const dt = 1 / fs
      const w0 = (Math.PI * p[P.bpm]) / 60
      const w2 = w0 * w0 * DIAL
      this.v += (-w2 * Math.sin(this.theta) - DAMP * this.v) * dt
      if (this.patched[this.iPlank]) this.plank(Math.sqrt(w2), dt)
      const at = p[P.tilt] * TILT_RAD
      const before = this.theta - at
      this.theta += this.v * dt
      const after = this.theta - at
      // the escapement: passing its point with some swing left, and a spring to push
      if (before < 0 !== after < 0 && Math.abs(this.v) > 0.15 && drive > 0.02) {
        this.v += Math.sign(this.v) * KICK * drive
        this.strike()
      }
    }

    this.out[this.oTick] = this.tickGate > 0 ? 10 : 0
    this.out[this.oBell] = this.bellGate > 0 ? 10 : 0
    if (this.tickGate > 0) this.tickGate--
    if (this.bellGate > 0) this.bellGate--
    this.out[this.oSwing] = Math.max(-10, Math.min(10, this.theta * MZ_VOLTS))
    this.out[this.oRst] = this.rstOut > 0 ? 10 : 0
    if (this.rstOut > 0) this.rstOut--
    this.out[this.oOut] = (this.clack.next() + this.bellVoice.next() * 0.5) * 5
    this.led[MZL.angle] = this.theta
    this.led[MZL.spring] = electric ? 1 : this.wound
    this.led[MZL.tick] *= FLASH_DECAY
    this.led[MZL.bell] *= FLASH_DECAY
  }
}
