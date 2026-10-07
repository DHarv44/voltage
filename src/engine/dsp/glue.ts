import { Dsp } from './base'
import { GLUE_ATTACK_MS, GLUE_METER, GLUE_RATIO_X, GLUE_RELEASE_S } from '../../modules/specs/mixbus'
import { TAU } from './util'

/** Soft-knee width (dB) and the sidechain filter's corner (Hz). */
const KNEE = 6
const SC_HPF = 90
/** 0 dB on the meter = a 5 V peak (the rack's full-scale audio). */
const FULL = 5

/** GLUE: a feed-forward, stereo-linked VCA bus compressor. The detector hears
 *  KEY if patched (else the input's mid), optionally through a high-pass so
 *  bass doesn't pump it; a soft-knee gain computer turns the level over
 *  THRESHOLD into gain reduction; attack and release smooth it (AUTO lets go
 *  quickly after a transient, slowly once the compression is sustained). */
export class GlueDsp extends Dsp {
  private iL = this.ii('l')
  private iR = this.ii('r')
  private iSc = this.ii('sc')
  private oL = this.oi('l')
  private oR = this.oi('r')
  private oGr = this.oi('gr')
  private P = {
    thresh: this.pi('thresh'), ratio: this.pi('ratio'), att: this.pi('att'), rel: this.pi('rel'),
    makeup: this.pi('makeup'), mix: this.pi('mix'), schp: this.pi('schp'),
  }
  private readonly hpK = Math.exp((-TAU * SC_HPF) / this.fs)
  private hpX = 0
  private hpY = 0
  /** Smoothed gain reduction (dB, ≥ 0), and how sustained it has been (0..1). */
  private gr = 0
  private sustain = 0
  private readonly sustainK = 1 - Math.exp(-1 / (2 * this.fs))

  tick(): void {
    const i = this.in
    const p = this.p
    const P = this.P
    const l = i[this.iL]
    const r = this.patched[this.iR] ? i[this.iR] : l

    // detector
    let det = this.patched[this.iSc] ? i[this.iSc] : (l + r) * 0.5
    if (p[P.schp] >= 0.5) {
      this.hpY = this.hpK * (this.hpY + det - this.hpX)
      this.hpX = det
      det = this.hpY
    } else this.hpX = this.hpY = det
    const db = 20 * Math.log10(Math.abs(det) / FULL + 1e-6)

    // soft-knee gain computer
    const slope = 1 - 1 / GLUE_RATIO_X[Math.round(p[P.ratio])]
    const over = db - p[P.thresh]
    const target = over <= -KNEE / 2 ? 0 : over >= KNEE / 2 ? over * slope : (slope * (over + KNEE / 2) ** 2) / (2 * KNEE)

    // attack / release (AUTO: 0.1 s after a hit, up to 1.2 s when held)
    this.sustain += ((target > 1 ? 1 : 0) - this.sustain) * this.sustainK
    let rel = GLUE_RELEASE_S[Math.round(p[P.rel])]
    if (rel < 0) rel = 0.1 + 1.1 * this.sustain
    const t = target > this.gr ? GLUE_ATTACK_MS[Math.round(p[P.att])] * 1e-3 : rel
    this.gr += (target - this.gr) * (1 - Math.exp(-1 / (t * this.fs)))

    const g = Math.pow(10, (p[P.makeup] - this.gr) / 20)
    const mix = p[P.mix]
    const wet = 1 - mix + mix * g
    this.out[this.oL] = l * wet
    this.out[this.oR] = r * wet
    this.out[this.oGr] = Math.min(10, this.gr * 0.5)
    for (let k = 0; k < GLUE_METER.length; k++) this.led[k] = this.gr >= GLUE_METER[k] ? 1 : 0
  }
}
