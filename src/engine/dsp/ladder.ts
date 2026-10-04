import { Dsp } from './base'
import { LadderCore } from './cores'
import { TAU } from './util'

/** Transistor-ladder lowpass. Each stage saturates like a differential pair;
 *  resonance self-oscillates near full, and bass thins as resonance rises.
 *  A whisper of thermal noise seeds self-oscillation and keeps states off denormals. */
export class LadderDsp extends Dsp {
  private iIn = this.ii('in')
  private iCv = this.ii('cv')
  private iV = this.ii('voct')
  private oLp4 = this.oi('lp4')
  private oLp2 = this.oi('lp2')
  private pCut = this.pi('cutoff')
  private pRes = this.pi('res')
  private pDrive = this.pi('drive')
  private pCv = this.pi('cv')

  private readonly ctol = this.tol(0.03)
  private readonly rtol = this.tol(0.02)
  private readonly w = TAU / (2 * this.fs)
  private readonly fMax = this.fs * 0.45
  private readonly core = new LadderCore()

  tick(): void {
    const i = this.in
    const p = this.p
    let fc = p[this.pCut] * this.ctol * Math.pow(2, i[this.iCv] * p[this.pCv] + i[this.iV])
    fc = fc < 5 ? 5 : fc > this.fMax ? this.fMax : fc
    const k = 4 * p[this.pRes] * this.rtol
    const x = (i[this.iIn] / 5) * p[this.pDrive] * (1 + 0.3 * k) + (this.rng.next() - 0.5) * 2e-4
    this.out[this.oLp4] = this.core.process(x, 1 - Math.exp(-fc * this.w), k) * 5
    this.out[this.oLp2] = this.core.lp2 * 5
  }
}
