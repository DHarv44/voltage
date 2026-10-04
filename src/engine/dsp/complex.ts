import { Dsp } from './base'
import { Drift } from './drift'
import { C4, TAU } from './util'
import { power } from './power'

const HALF_PI = Math.PI / 2

/** Buchla-259-style complex oscillator. The modulator (sine) phase-modulates the
 *  principal sine (equivalent to linear through-zero FM, so pitch stays put as
 *  INDEX rises). The principal then goes through an anti-aliased sine folder
 *  (TIMBRE = fold depth, SYMMETRY = DC offset into the folder). */
export class ComplexDsp extends Dsp {
  private iV = this.ii('voct')
  private iIdx = this.ii('idx')
  private iTmb = this.ii('tmb')
  private iMv = this.ii('mvoct')
  private oMod = this.oi('mod')
  private oSine = this.oi('sine')
  private oOut = this.oi('out')
  private pM = this.pi('mfreq')
  private pP = this.pi('pfreq')
  private pFine = this.pi('fine')
  private pIdx = this.pi('index')
  private pTmb = this.pi('timbre')
  private pSym = this.pi('sym')
  private pTrack = this.pi('track')

  private mPhase = 0
  private pPhase = 0
  private uPrev = 0
  private readonly drift = new Drift(this.rng, this.fs)
  private readonly track = this.tol(0.0035)

  tick(): void {
    const i = this.in
    const p = this.p
    const v = i[this.iV] * this.track + this.drift.next(this.age) + power.pitchSag
    const mf = p[this.pM] * Math.pow(2, i[this.iMv] + (p[this.pTrack] >= 0.5 ? v : 0))
    const pf = C4 * Math.pow(2, v + p[this.pP] + p[this.pFine] / 12)
    this.mPhase += Math.min(mf / this.fs, 0.45)
    if (this.mPhase >= 1) this.mPhase -= 1
    this.pPhase += Math.min(pf / this.fs, 0.45)
    if (this.pPhase >= 1) this.pPhase -= 1

    const mod = Math.sin(TAU * this.mPhase)
    const index = Math.max(0, p[this.pIdx] + i[this.iIdx] / 2)
    const sine = Math.sin(TAU * this.pPhase + index * mod)

    // Folder (first-order ADAA, as in FOLD)
    const depth = 1 + Math.max(0, Math.min(1.5, p[this.pTmb] + i[this.iTmb] / 10)) * 6
    const u = (sine * depth + p[this.pSym]) * HALF_PI
    const du = u - this.uPrev
    const folded = Math.abs(du) > 1e-6 ? (Math.cos(this.uPrev) - Math.cos(u)) / du : Math.sin(0.5 * (u + this.uPrev))
    this.uPrev = u

    const o = this.out
    o[this.oMod] = mod * 5
    o[this.oSine] = sine * 5
    o[this.oOut] = folded * 5
  }
}
