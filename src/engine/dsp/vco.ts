import { Dsp } from './base'
import { OscCore } from './cores'
import { Drift } from './drift'
import { C4 } from './util'
import { power } from './power'

/** Sawtooth-core VCO. PolyBLEP keeps saw/pulse alias-free; the expo converter
 *  has a per-unit tracking error and the core drifts with temperature. */
export class VcoDsp extends Dsp {
  private iV = this.ii('voct')
  private iFm = this.ii('fm')
  private iPwm = this.ii('pwm')
  private iSync = this.ii('sync')
  private oSin = this.oi('sin')
  private oTri = this.oi('tri')
  private oSaw = this.oi('saw')
  private oSqr = this.oi('sqr')
  private pCoarse = this.pi('coarse')
  private pFine = this.pi('fine')
  private pFm = this.pi('fm')
  private pPw = this.pi('pw')
  private pPwm = this.pi('pwm')

  /** 1V/oct scaling error of this unit's exponential converter (~±4 cents/oct). */
  private readonly track = this.tol(0.0035)
  private readonly drift = new Drift(this.rng, this.fs)
  private readonly osc = new OscCore()
  private lastSync = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.osc.phase = this.rng.next()
  }

  tick(): void {
    const i = this.in
    const p = this.p
    const o = this.out
    const oct =
      i[this.iV] * this.track +
      p[this.pCoarse] +
      p[this.pFine] / 12 +
      i[this.iFm] * p[this.pFm] +
      this.drift.next(this.age) +
      power.pitchSag
    const f = Math.min(C4 * Math.pow(2, oct), this.fs * 0.45)

    const s = i[this.iSync]
    if (s > 1 && this.lastSync <= 1) this.osc.phase = 0
    this.lastSync = s

    let pw = p[this.pPw] + (i[this.iPwm] / 10) * p[this.pPwm]
    pw = pw < 0.02 ? 0.02 : pw > 0.98 ? 0.98 : pw

    const osc = this.osc
    osc.step(f / this.fs, pw)
    o[this.oSin] = osc.sin * 5
    o[this.oTri] = osc.tri * 5
    o[this.oSaw] = osc.saw * 5
    o[this.oSqr] = osc.sqr * 5
  }
}
