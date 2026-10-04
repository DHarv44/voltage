import { Dsp } from './base'
import { fastTanh, rails } from './util'

/** Integrator state limit: linear in normal use, soft knee near the op-amp swing. */
const sat = (v: number) => rails(v, 14)

/** Trapezoidal (zero-delay-feedback) state-variable filter after Simper.
 *  Clean and smooth like an SEM: all four responses come from one core.
 *  A gentle input stage saturates hot signals. */
export class SvfDsp extends Dsp {
  private iIn = this.ii('in')
  private iCv = this.ii('cv')
  private iV = this.ii('voct')
  private pCut = this.pi('cutoff')
  private pRes = this.pi('res')
  private pCv = this.pi('cv')
  private readonly ctol = this.tol(0.03)
  private readonly fMax = this.fs * 0.45
  private ic1 = 0
  private ic2 = 0

  tick(): void {
    const i = this.in
    const p = this.p
    let fc = p[this.pCut] * this.ctol * Math.pow(2, i[this.iCv] * p[this.pCv] + i[this.iV])
    fc = fc < 5 ? 5 : fc > this.fMax ? this.fMax : fc
    const g = Math.tan((Math.PI * fc) / this.fs)
    const k = 2 - 1.9 * p[this.pRes]
    const a1 = 1 / (1 + g * (g + k))
    const a2 = g * a1
    const a3 = g * a2
    const v0 = 6 * fastTanh(i[this.iIn] / 6)
    const v3 = v0 - this.ic2
    const v1 = a1 * this.ic1 + a2 * v3
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3
    // Integrator op-amps run out of swing near the rails: soft-limit their states.
    this.ic1 = sat(2 * v1 - this.ic1)
    this.ic2 = sat(2 * v2 - this.ic2)
    const hp = v0 - k * v1 - v2
    const o = this.out
    o[0] = rails(v2)
    o[1] = rails(v1)
    o[2] = rails(hp)
    o[3] = rails(v2 + hp)
  }
}

/** Diode-clipped 12 dB filter in the spirit of the MS-20: a 2× oversampled
 *  Chamberlin SVF whose band-pass state runs through asymmetric diode clipping.
 *  Push PEAK past ~1 and it screams into self-oscillation, amplitude held by the diodes. */
export class MsFilterDsp extends Dsp {
  private iIn = this.ii('in')
  private iCv = this.ii('cv')
  private iV = this.ii('voct')
  private pCut = this.pi('cutoff')
  private pPeak = this.pi('peak')
  private pCv = this.pi('cv')
  private readonly ctol = this.tol(0.04)
  private readonly fMax = this.fs * 0.33
  private lp = 0
  private bp = 0
  private xPrev = 0

  tick(): void {
    const i = this.in
    const p = this.p
    let fc = p[this.pCut] * this.ctol * Math.pow(2, i[this.iCv] * p[this.pCv] + i[this.iV])
    fc = fc < 5 ? 5 : fc > this.fMax ? this.fMax : fc
    const f = 2 * Math.sin((Math.PI * fc) / (2 * this.fs))
    const q = Math.max(-0.25, 1.6 * (1 - p[this.pPeak]))
    const x1 = i[this.iIn] / 5 + (this.rng.next() - 0.5) * 2e-4
    let lpSum = 0
    let hpSum = 0
    for (let n = 0; n < 2; n++) {
      const x = n === 0 ? 0.5 * (x1 + this.xPrev) : x1
      const hp = x - this.lp - q * this.bp
      this.bp = diode(this.bp + f * hp)
      this.lp += f * this.bp
      lpSum += this.lp
      hpSum += hp
    }
    this.xPrev = x1
    this.out[0] = lpSum * 2.5
    this.out[1] = hpSum * 2.5
  }
}

/** Asymmetric soft clip: the two diodes never match, which adds even harmonics. */
function diode(v: number): number {
  return v > 0 ? fastTanh(v * 1.25) / 1.25 : fastTanh(v * 1.05) / 1.05
}
