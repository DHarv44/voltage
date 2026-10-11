import { Biquad, Changed } from './biquad'
import { Dsp } from './base'
import { DelayLine } from './delayLine'
import { TAU } from './util'

const HEAD_R = 0.0875
const C = 343
const MAX_DIST = 20
/** Early reflections: delays (s) and gains, a small room's first bounces. */
const REFL = [0.0071, 0.0113, 0.0173, 0.0241, 0.0317]
const RGAIN = [0.5, 0.42, 0.35, 0.3, 0.24]

/** SPACE: the sound arrives at each ear through its own delay: the distance
 *  to that ear (Woodworth's head model: the far ear also waits for the way
 *  round the head), so moving it bends the pitch (Doppler). The far ear is
 *  shadowed (a low-pass that closes as the source goes round), a sound from
 *  behind loses some brightness, and the ear's fold puts a notch that climbs
 *  with HEIGHT. Distance: level falls as 1/r, the air takes the highs, and a
 *  room's first reflections stay put while the direct sound shrinks. The
 *  LEDs carry the position for the screen. */
export class SpaceDsp extends Dsp {
  private readonly I = { in: this.ii('in'), az: this.ii('azcv'), el: this.ii('elcv'), d: this.ii('dcv') }
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly P = { az: this.pi('az'), el: this.pi('el'), dist: this.pi('dist'), room: this.pi('room'), doppler: this.pi('doppler') }
  private readonly line: DelayLine
  private readonly shadowL = new Biquad(this.fs)
  private readonly shadowR = new Biquad(this.fs)
  private readonly pinnaL = new Biquad(this.fs)
  private readonly pinnaR = new Biquad(this.fs)
  private readonly rearL = new Biquad(this.fs)
  private readonly rearR = new Biquad(this.fs)
  private readonly changed = new Changed()
  private air = 0
  private airK = 1
  private dl = -1
  private dr = -1
  private dlT = 0
  private drT = 0
  private readonly glide = 1 - Math.exp(-1 / (0.03 * this.fs))
  private n = 0
  private gl = 1
  private gr = 1
  private dg = 1

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.line = new DelayLine(Math.ceil(((MAX_DIST + 1) / C + 0.04) * this.fs))
  }

  /** Re-design the filters for the position (every 32 samples). */
  private place(az: number, el: number, dist: number): void {
    const a = (az * Math.PI) / 180
    const e = (el * Math.PI) / 180
    // lateral angle (−90 left … 90 right) as the ears hear it
    const lat = Math.asin(Math.max(-1, Math.min(1, Math.sin(a) * Math.cos(e))))
    const front = Math.cos(a) * Math.cos(e)
    // path to each ear: Woodworth, plus the distance (s)
    const itd = (HEAD_R / C) * (Math.abs(lat) + Math.sin(Math.abs(lat)))
    const base = dist / C
    const nearT = base
    const farT = base + itd
    const tl = lat > 0 ? farT : nearT
    const tr = lat > 0 ? nearT : farT
    const dop = this.p[this.P.doppler] >= 0.5
    this.dlT = (dop ? tl : itd * (lat > 0 ? 1 : 0)) * this.fs + 2
    this.drT = (dop ? tr : itd * (lat > 0 ? 0 : 1)) * this.fs + 2
    if (this.dl < 0) {
      this.dl = this.dlT
      this.dr = this.drT
    }
    if (!this.changed.test(Math.round(az), Math.round(el), Math.round(dist * 10))) return
    // the head's shadow on the far ear
    const shade = Math.abs(Math.sin(lat))
    const farHz = 18000 * Math.pow(1500 / 18000, shade)
    this.shadowL.lowpass(lat > 0 ? farHz : 18000, 0.6)
    this.shadowR.lowpass(lat > 0 ? 18000 : farHz, 0.6)
    // the ear's fold: a notch climbing from 6 to 11 kHz as the source rises
    const notch = 6000 + Math.max(0, Math.min(1, (el + 40) / 130)) * 5000
    this.pinnaL.peak(notch, 3, -9)
    this.pinnaR.peak(notch * 1.04, 3, -9)
    // behind: duller
    const rear = front < 0 ? -front * 6 : 0
    this.rearL.highShelf(4000, -rear)
    this.rearR.highShelf(4000, -rear)
    // level: 1/r from a metre, the near ear a touch louder; air takes the highs
    this.dg = 1 / Math.max(0.3, dist)
    this.gl = 1 + 0.25 * -Math.sin(lat)
    this.gr = 1 + 0.25 * Math.sin(lat)
    this.airK = 1 - Math.exp((-TAU * (20000 / (1 + dist * 0.25))) / this.fs)
    this.led[0] = az / 180
    this.led[1] = el / 90
    this.led[2] = dist / MAX_DIST
  }

  tick(): void {
    const p = this.p
    const x = this.in[this.I.in]
    if (this.n++ % 32 === 0 || this.dl < 0) {
      let az = p[this.P.az] + (this.patched[this.I.az] ? this.in[this.I.az] * 36 : 0)
      az = ((((az + 180) % 360) + 360) % 360) - 180
      const el = Math.max(-40, Math.min(90, p[this.P.el] + (this.patched[this.I.el] ? this.in[this.I.el] * 13 : 0)))
      const dist = Math.max(0.3, Math.min(MAX_DIST, p[this.P.dist] * Math.pow(2, this.patched[this.I.d] ? this.in[this.I.d] : 0)))
      this.place(az, el, dist)
    }
    this.dl += (this.dlT - this.dl) * this.glide
    this.dr += (this.drT - this.dr) * this.glide
    this.air += (x - this.air) * this.airK
    this.line.write(this.air)
    const yl = this.line.tapHermite(this.dl) * this.dg * this.gl
    const yr = this.line.tapHermite(this.dr) * this.dg * this.gr
    let l = this.rearL.run(this.pinnaL.run(this.shadowL.run(yl)))
    let r = this.rearR.run(this.pinnaR.run(this.shadowR.run(yr)))
    // the room: early reflections from either side, not shrinking with distance as fast
    const room = p[this.P.room]
    if (room > 0.001) {
      for (let i = 0; i < REFL.length; i++) {
        const t = (this.dl + this.dr) * 0.5 + REFL[i] * this.fs
        const v = this.line.tapLin(t) * RGAIN[i] * room * 0.7
        if (i % 2) r += v
        else l += v
      }
    }
    this.out[this.oL] = l
    this.out[this.oR] = r
  }
}
