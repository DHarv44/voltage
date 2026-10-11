import { CD_MAX_BARS, CD_SEGMENTS, CDL } from '../../modules/specs/conductor'
import { Dsp } from './base'
import { Schmitt } from './cores'

const PULSE_S = 0.005

/** CONDUCTOR: a running position in 16ths through the tempo map. Each sample
 *  the tempo is read where it is in its segment (a ramp moves it smoothly),
 *  and the position moves on by that much. Outputs are square waves, high
 *  for the first half of each 16th, 8th, beat and bar, like CLOCK's. */
export class ConductorDsp extends Dsp {
  private readonly iRst = this.ii('rst')
  private readonly iRun = this.ii('run')
  private readonly O = {
    x4: this.oi('x4'),
    x2: this.oi('x2'),
    beat: this.oi('beat'),
    bar: this.oi('bar'),
    rst: this.oi('rsto'),
    tempo: this.oi('tempo'),
    end: this.oi('end'),
  }
  private readonly pLen = this.pi('len')
  private readonly pScale = this.pi('scale')
  private readonly pLoop = this.pi('loop')
  private readonly pRun = this.pi('run')
  private readonly pS0 = this.pi('b0')
  private readonly rst = new Schmitt()
  private seg = 0
  /** Position in the segment, in 16ths (whole and fraction). */
  private pos = 0
  private wasRunning = false
  private done = false
  private rstPulse = 0
  private endPulse = 0

  private f(k: number, i: number): number {
    return Math.round(this.p[this.pS0 + k * 4 + i])
  }

  private meter(k: number): number {
    return Math.max(2, Math.min(7, this.f(k, 3)))
  }

  private stepsIn(k: number): number {
    return Math.max(1, Math.min(CD_MAX_BARS, this.f(k, 0))) * this.meter(k) * 4
  }

  /** High through the first half of each whole of v (CLOCK's squares). */
  private half(go: boolean, v: number): number {
    return go && v - Math.floor(v) < 0.5 ? 10 : 0
  }

  private start(): void {
    this.seg = 0
    this.pos = 0
    this.done = false
    this.rstPulse = Math.round(PULSE_S * this.fs)
  }

  tick(): void {
    const p = this.p
    const running = p[this.pRun] >= 0.5 && (this.patched[this.iRun] !== 1 || this.in[this.iRun] > 1)
    if ((running && !this.wasRunning) || this.rst.rise(this.in[this.iRst])) this.start()
    this.wasRunning = running
    const len = Math.max(1, Math.min(CD_SEGMENTS, Math.round(p[this.pLen])))
    const k = Math.min(this.seg, len - 1)
    const steps = this.stepsIn(k)
    const from = this.f(k, 1)
    const to = this.f(k, 2) > 0 ? this.f(k, 2) : from
    const bpm = (from + (to - from) * Math.min(1, this.pos / steps)) * p[this.pScale]
    const go = running && !this.done
    if (go) {
      this.pos += (bpm / 60) * 4 / this.fs
      if (this.pos >= steps) {
        this.pos -= steps
        this.seg++
        if (this.seg >= len) {
          this.endPulse = Math.round(PULSE_S * this.fs)
          if (p[this.pLoop] >= 0.5) {
            this.seg = 0
            this.rstPulse = Math.round(PULSE_S * this.fs)
          } else {
            this.done = true
            this.seg = len - 1
            this.pos = 0
          }
        }
      }
    }
    const o = this.out
    const x = this.pos
    const m = this.meter(Math.min(this.seg, len - 1))
    o[this.O.x4] = this.half(go, x)
    o[this.O.x2] = this.half(go, x / 2)
    o[this.O.beat] = this.half(go, x / 4)
    o[this.O.bar] = this.half(go, x / (m * 4))
    o[this.O.rst] = this.rstPulse > 0 ? 10 : 0
    o[this.O.end] = this.endPulse > 0 ? 10 : 0
    o[this.O.tempo] = bpm / 100
    if (this.rstPulse > 0) this.rstPulse--
    if (this.endPulse > 0) this.endPulse--
    this.led[CDL.seg] = go ? this.seg : -1
    this.led[CDL.bar] = Math.floor(x / (m * 4))
    this.led[CDL.beat] = Math.floor(x / 4) % m
    this.led[CDL.bpm] = bpm
  }
}
