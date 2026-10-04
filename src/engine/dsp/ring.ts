import { Dsp } from './base'
import { OscCore } from './cores'
import { fastTanh } from './util'

const D = fastTanh(1.3)
/** Diode-ring transfer: near-linear for small signals, softly compressing when hot. */
const diode = (v: number) => fastTanh(1.3 * v) / D

/** Diode-ring modulator: output ≈ IN × CARRIER (sum and difference frequencies).
 *  CARR is normalled to an internal sine oscillator whose FREQ is the 0 V pitch and
 *  which tracks 1V/OCT, so a fixed non-integer ratio to the note gives consistent
 *  inharmonic bell/steel-drum partials. The ring is never perfectly balanced: a
 *  little of each input leaks through, like the real transformer circuit. */
export class RingDsp extends Dsp {
  private iX = this.ii('x')
  private iY = this.ii('y')
  private iV = this.ii('voct')
  private pFreq = this.pi('freq')
  private pMix = this.pi('mix')
  private readonly osc = new OscCore()
  private readonly ftol = this.tol(0.01)
  private readonly leakX = 0.012 * this.tol(0.3)
  private readonly leakY = 0.008 * this.tol(0.3)

  tick(): void {
    const i = this.in
    const p = this.p
    const f = p[this.pFreq] * this.ftol * Math.pow(2, i[this.iV])
    this.osc.step(Math.min(f / this.fs, 0.45), 0.5)
    const oscV = this.osc.sin * 5
    const x = i[this.iX]
    const y = this.patched[this.iY] ? i[this.iY] : oscV
    const ringV = 5 * diode(x / 5) * diode(y / 5) + this.leakX * x + this.leakY * y
    const mix = p[this.pMix]
    this.out[0] = x * (1 - mix) + ringV * mix
    this.out[1] = oscV
  }
}
