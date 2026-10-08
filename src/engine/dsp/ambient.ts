import { SHIMMER_SEMIS } from '../../modules/specs/ambient'
import { Dsp } from './base'
import { DelayLine } from './delayLine'
import { PitchShifter } from './pitchShift'
import { PlateCore } from './plate'
import { fastTanh, rails } from './util'

/** SHIMMER: the plate with a pitch-shifted copy of its tail fed back in. */
export class ShimmerDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iShm = this.ii('shm')
  private readonly iFrz = this.ii('frz')
  private readonly pDecay = this.pi('decay')
  private readonly pShimmer = this.pi('shimmer')
  private readonly pInterval = this.pi('interval')
  private readonly pDamp = this.pi('damp')
  private readonly pMix = this.pi('mix')
  private readonly pFreeze = this.pi('freeze')
  private readonly plate = new PlateCore(this.fs)
  private readonly shifter = new PitchShifter(this.fs)
  private fb = 0
  /** The climbing copy is high-passed, so octaves pile up as air, not mud. */
  private lp = 0
  private readonly hpK = 1 - Math.exp((-2 * Math.PI * 220) / this.fs)
  /** Ease input in and out of FREEZE (no click). */
  private inGain = 1

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    const frozen = p[this.pFreeze] >= 0.5 || this.in[this.iFrz] > 1
    this.inGain += ((frozen ? 0 : 1) - this.inGain) * 0.002
    const amt = Math.min(1, Math.max(0, p[this.pShimmer] + this.in[this.iShm] / 10)) * (frozen ? 0.5 : 1)
    this.plate.process(x * this.inGain + this.fb, frozen ? 1 : p[this.pDecay], frozen ? 0.05 : p[this.pDamp], 0.02)
    const wet = (this.plate.l + this.plate.r) * 0.5
    const ratio = Math.pow(2, SHIMMER_SEMIS[Math.round(p[this.pInterval])] / 12)
    const up = this.shifter.process(wet, ratio, 0.09)
    this.lp += (up - this.lp) * this.hpK
    // soft-limited, so a frozen tail at full shimmer swells but never runs away
    this.fb = 2.5 * fastTanh(((up - this.lp) * amt * 0.55) / 2.5)
    const mix = p[this.pMix]
    this.out[0] = x * (1 - mix) + this.plate.l * 0.6 * mix
    this.out[1] = x * (1 - mix) + this.plate.r * 0.6 * mix
  }
}

/** SHIFT: two pitch-shifted voices and a feedback spiral. */
export class ShiftDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iA = this.ii('cva')
  private readonly iB = this.ii('cvb')
  private readonly P = {
    a: this.pi('a'),
    b: this.pi('b'),
    fine: this.pi('fine'),
    la: this.pi('la'),
    lb: this.pi('lb'),
    size: this.pi('size'),
    fb: this.pi('fb'),
    delay: this.pi('delay'),
    mix: this.pi('mix'),
  }
  private readonly va = new PitchShifter(this.fs, 0.25)
  private readonly vb = new PitchShifter(this.fs, 0.25)
  private readonly line = new DelayLine(this.fs * 1.05)

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    const back = fastTanh(this.line.tapLin(Math.max(2, p[this.P.delay] * this.fs)) * p[this.P.fb] / 5) * 5
    const src = x + back
    // FINE detunes the two voices apart (a doubling, when A and B match)
    const ra = Math.pow(2, (p[this.P.a] + p[this.P.fine]) / 12 + this.in[this.iA])
    const rb = Math.pow(2, (p[this.P.b] - p[this.P.fine]) / 12 + this.in[this.iB])
    const size = p[this.P.size]
    const ya = this.va.process(src, ra, size) * p[this.P.la]
    const yb = this.vb.process(src, rb, size) * p[this.P.lb]
    this.line.write(ya + yb)
    const mix = p[this.P.mix]
    this.out[0] = rails(x * (1 - mix) + (ya * 0.85 + yb * 0.35) * mix)
    this.out[1] = rails(x * (1 - mix) + (ya * 0.35 + yb * 0.85) * mix)
  }
}
