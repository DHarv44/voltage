import { Dsp } from './base'
import { TAU, fastTanh } from './util'

const MAX_TIME = 1
/** Stages of the modelled BBD chip (MN3005-class). */
const STAGES = 4096

/** Bucket-brigade delay. A BBD's clock is set by the delay time, and its
 *  bandwidth by the clock: f_nyq = STAGES / (4 · time). So long delays are dark,
 *  every repeat passes the anti-alias filters again (repeats darken), and
 *  moving TIME glides the clock, which bends the pitch of what's in the line.
 *  Feedback saturates in the compander, so REPEATS past 100% self-oscillates
 *  without blowing up. WARBLE = clock wobble (LFO + slow random drift). */
export class BbdDsp extends Dsp {
  private iIn = this.ii('in')
  private iTime = this.ii('time')
  private pTime = this.pi('time')
  private pFb = this.pi('fb')
  private pMix = this.pi('mix')
  private pMod = this.pi('mod')

  private readonly buf = new Float32Array(Math.ceil(MAX_TIME * 1.05 * this.fs) + 8)
  private w = 0
  private tSm = this.p[this.pTime]
  /** ~60 ms clock glide: the audible "pitch bend" when you turn TIME. */
  private readonly kGlide = 1 - Math.exp(-1 / (0.06 * this.fs))
  private lp1 = 0
  private lp2 = 0
  private lfo = this.rng.next()
  private readonly lfoInc = (0.45 * this.tol(0.1)) / this.fs
  private walk = 0
  private env = 0

  private read(delaySamples: number): number {
    const b = this.buf
    const n = b.length
    let pos = this.w - delaySamples
    while (pos < 1) pos += n
    const i = Math.floor(pos)
    const f = pos - i
    const ym1 = b[(i - 1) % n]
    const y0 = b[i % n]
    const y1 = b[(i + 1) % n]
    const y2 = b[(i + 2) % n]
    // 4-point Hermite interpolation
    const c1 = 0.5 * (y1 - ym1)
    const c2 = ym1 - 2.5 * y0 + 2 * y1 - 0.5 * y2
    const c3 = 0.5 * (y2 - ym1) + 1.5 * (y0 - y1)
    return ((c3 * f + c2) * f + c1) * f + y0
  }

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    let target = p[this.pTime] * Math.pow(2, -this.in[this.iTime])
    target = target < 0.01 ? 0.01 : target > MAX_TIME ? MAX_TIME : target
    this.tSm += (target - this.tSm) * this.kGlide

    this.lfo += this.lfoInc
    if (this.lfo >= 1) this.lfo -= 1
    this.walk += ((this.rng.next() - 0.5) * 0.02 - this.walk * 0.0005) * 0.05
    const wobble = 1 + p[this.pMod] * (0.006 * Math.sin(TAU * this.lfo) + 0.5 * this.walk)
    const t = this.tSm * wobble

    const raw = this.read(t * this.fs)
    // Anti-alias / reconstruction filters track the BBD clock.
    const fc = Math.min(STAGES / (4 * t) * 0.4, 12000, this.fs * 0.45)
    const a = 1 - Math.exp((-TAU * fc) / this.fs)
    this.lp1 += a * (raw - this.lp1)
    this.lp2 += a * (this.lp1 - this.lp2)
    const wet = this.lp2

    const hiss = (this.rng.next() - 0.5) * 0.004
    this.buf[this.w] = x + 6 * fastTanh((p[this.pFb] * wet) / 6) + hiss
    if (++this.w >= this.buf.length) this.w = 0

    const mix = p[this.pMix]
    this.out[0] = x * (1 - mix) + wet * mix
    this.out[1] = wet
    const aw = wet < 0 ? -wet : wet
    this.env = aw > this.env ? aw : this.env * 0.9995
    this.led[0] = this.env / 5
  }
}
