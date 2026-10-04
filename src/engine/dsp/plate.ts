import { Dsp } from './base'
import { Allpass, DelayLine } from './delayLine'
import { TAU } from './util'

/** Dattorro's plate (J. Dattorro, "Effect Design Part 1", 1997). Lengths are
 *  the published values at 29761 Hz, scaled to the engine rate. */
const REF_FS = 29761

/** Dattorro plate reverb: predelay → bandwidth filter → four input diffusers →
 *  figure-eight tank of two branches (modulated allpass, delay, damping, decay,
 *  allpass, delay), with the published stereo output taps. */
export class PlateDsp extends Dsp {
  private iIn = this.ii('in')
  private pDecay = this.pi('decay')
  private pDamp = this.pi('damp')
  private pPre = this.pi('pre')
  private pMix = this.pi('mix')

  private readonly s = this.fs / REF_FS
  private readonly n = (v: number) => Math.round(v * this.s)

  private readonly pre = new DelayLine(0.21 * this.fs)
  private bw = 0
  private readonly diff = [
    new Allpass(this.n(142), 0.75),
    new Allpass(this.n(107), 0.75),
    new Allpass(this.n(379), 0.625),
    new Allpass(this.n(277), 0.625),
  ]
  // Left branch
  private readonly lAp1 = new Allpass(this.n(672), 0.7, this.n(32))
  private readonly lD1Len = this.n(4453)
  private readonly lD1 = new DelayLine(this.lD1Len)
  private readonly lAp2 = new Allpass(this.n(1800), 0.5)
  private readonly lD2Len = this.n(3720)
  private readonly lD2 = new DelayLine(this.lD2Len)
  // Right branch
  private readonly rAp1 = new Allpass(this.n(908), 0.7, this.n(32))
  private readonly rD1Len = this.n(4217)
  private readonly rD1 = new DelayLine(this.rD1Len)
  private readonly rAp2 = new Allpass(this.n(2656), 0.5)
  private readonly rD2Len = this.n(3163)
  private readonly rD2 = new DelayLine(this.rD2Len)
  private lDamp = 0
  private rDamp = 0
  private lFeed = 0 // left tank output, fed into the right branch next sample
  private rFeed = 0
  private lfo = 0
  private readonly exc = this.n(16)

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    const decay = p[this.pDecay]
    const damp = 0.0005 + 0.7 * p[this.pDamp]
    const g2 = Math.min(0.5, Math.max(0.25, decay + 0.15)) // decay diffusion 2 tracks decay
    this.lAp2.g = g2
    this.rAp2.g = g2

    // Input: predelay, bandwidth (gentle lowpass), diffusion
    this.pre.write(x * 0.5)
    const pd = Math.max(1, Math.round(p[this.pPre] * this.fs))
    this.bw += (this.pre.tap(pd) - this.bw) * 0.9995
    let d = this.bw
    const diff = this.diff
    for (let k = 0; k < diff.length; k++) d = diff[k].process(d)

    // Tank (cross-coupled branches), with slow modulation of the first allpasses
    this.lfo += 1 / this.fs
    if (this.lfo >= 1) this.lfo -= 1
    const m = Math.sin(TAU * this.lfo) * this.exc

    let l = this.lAp1.process(d + this.rFeed * decay, this.exc + m)
    this.lD1.write(l)
    l = this.lD1.tap(this.lD1Len)
    this.lDamp += (l - this.lDamp) * (1 - damp)
    l = this.lAp2.process(this.lDamp * decay)
    this.lD2.write(l)
    const lOut = this.lD2.tap(this.lD2Len)

    let r = this.rAp1.process(d + this.lFeed * decay, this.exc - m)
    this.rD1.write(r)
    r = this.rD1.tap(this.rD1Len)
    this.rDamp += (r - this.rDamp) * (1 - damp)
    r = this.rAp2.process(this.rDamp * decay)
    this.rD2.write(r)
    const rOut = this.rD2.tap(this.rD2Len)

    this.lFeed = lOut
    this.rFeed = rOut

    // Published output taps
    const n = this.n
    const yL =
      this.rD1.tap(n(266)) + this.rD1.tap(n(2974)) - this.rAp2.line.tap(n(1913)) + this.rD2.tap(n(1996)) -
      this.lD1.tap(n(1990)) - this.lAp2.line.tap(n(187)) - this.lD2.tap(n(1066))
    const yR =
      this.lD1.tap(n(353)) + this.lD1.tap(n(3627)) - this.lAp2.line.tap(n(1228)) + this.lD2.tap(n(2673)) -
      this.rD1.tap(n(2111)) - this.rAp2.line.tap(n(335)) - this.rD2.tap(n(121))

    const mix = p[this.pMix]
    this.out[0] = x * (1 - mix) + yL * 0.6 * mix
    this.out[1] = x * (1 - mix) + yR * 0.6 * mix
  }
}
