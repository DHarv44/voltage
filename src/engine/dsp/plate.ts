import { Dsp } from './base'
import { Allpass, DelayLine } from './delayLine'
import { TAU } from './util'

/** Dattorro's plate (J. Dattorro, "Effect Design Part 1", 1997). Lengths are
 *  the published values at 29761 Hz, scaled to the engine rate. */
const REF_FS = 29761

/** The plate itself: predelay → bandwidth filter → four input diffusers →
 *  figure-eight tank of two branches (modulated allpass, delay, damping, decay,
 *  allpass, delay), with the published stereo output taps. Shared by PLATE
 *  and SHIMMER (which feeds a pitch-shifted copy of the tail back in). */
export class PlateCore {
  private readonly s: number
  private readonly n: (v: number) => number
  private readonly pre: DelayLine
  private bw = 0
  private readonly diff: Allpass[]
  private readonly lAp1: Allpass
  private readonly lD1Len: number
  private readonly lD1: DelayLine
  private readonly lAp2: Allpass
  private readonly lD2Len: number
  private readonly lD2: DelayLine
  private readonly rAp1: Allpass
  private readonly rD1Len: number
  private readonly rD1: DelayLine
  private readonly rAp2: Allpass
  private readonly rD2Len: number
  private readonly rD2: DelayLine
  private lDamp = 0
  private rDamp = 0
  private lFeed = 0 // left tank output, fed into the right branch next sample
  private rFeed = 0
  private lfo = 0
  private readonly exc: number
  /** The wet output, this sample. */
  l = 0
  r = 0

  constructor(private readonly fs: number) {
    this.s = fs / REF_FS
    const n = (v: number) => Math.round(v * this.s)
    this.n = n
    this.pre = new DelayLine(0.21 * fs)
    this.diff = [new Allpass(n(142), 0.75), new Allpass(n(107), 0.75), new Allpass(n(379), 0.625), new Allpass(n(277), 0.625)]
    this.lAp1 = new Allpass(n(672), 0.7, n(32))
    this.lD1Len = n(4453)
    this.lD1 = new DelayLine(this.lD1Len)
    this.lAp2 = new Allpass(n(1800), 0.5)
    this.lD2Len = n(3720)
    this.lD2 = new DelayLine(this.lD2Len)
    this.rAp1 = new Allpass(n(908), 0.7, n(32))
    this.rD1Len = n(4217)
    this.rD1 = new DelayLine(this.rD1Len)
    this.rAp2 = new Allpass(n(2656), 0.5)
    this.rD2Len = n(3163)
    this.rD2 = new DelayLine(this.rD2Len)
    this.exc = n(16)
  }

  /** One sample: `decay` 0..~1 (1 = holds forever), `damp` 0..1, `preS` seconds. */
  process(x: number, decay: number, damp01: number, preS: number): void {
    const damp = 0.0005 + 0.7 * damp01
    const g2 = Math.min(0.5, Math.max(0.25, decay + 0.15)) // decay diffusion 2 tracks decay
    this.lAp2.g = g2
    this.rAp2.g = g2

    // Input: predelay, bandwidth (gentle lowpass), diffusion
    this.pre.write(x * 0.5)
    const pd = Math.max(1, Math.round(preS * this.fs))
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
    this.l =
      this.rD1.tap(n(266)) + this.rD1.tap(n(2974)) - this.rAp2.line.tap(n(1913)) + this.rD2.tap(n(1996)) -
      this.lD1.tap(n(1990)) - this.lAp2.line.tap(n(187)) - this.lD2.tap(n(1066))
    this.r =
      this.lD1.tap(n(353)) + this.lD1.tap(n(3627)) - this.lAp2.line.tap(n(1228)) + this.lD2.tap(n(2673)) -
      this.rD1.tap(n(2111)) - this.rAp2.line.tap(n(335)) - this.rD2.tap(n(121))
  }
}

/** PLATE: the plate, dry/wet. */
export class PlateDsp extends Dsp {
  private iIn = this.ii('in')
  private pDecay = this.pi('decay')
  private pDamp = this.pi('damp')
  private pPre = this.pi('pre')
  private pMix = this.pi('mix')
  private readonly plate = new PlateCore(this.fs)

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    this.plate.process(x, p[this.pDecay], p[this.pDamp], p[this.pPre])
    const mix = p[this.pMix]
    this.out[0] = x * (1 - mix) + this.plate.l * 0.6 * mix
    this.out[1] = x * (1 - mix) + this.plate.r * 0.6 * mix
  }
}
