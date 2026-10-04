import type { ModuleSpec } from '../../../modules/types'
import { DcBlock, PEDAL_IN, PedalDsp } from './base'

/** Germanium transistor stage: soft and asymmetric, with a collector bias that
 *  shifts the clipping point. Starved bias (low BIAS) gates and sputters. */
function germanium(x: number, bias: number): number {
  const v = x + bias
  const y = v > 0 ? 1 - Math.exp(-v) : -0.6 * (1 - Math.exp(v / 0.6))
  return y - (bias > 0 ? 1 - Math.exp(-bias) : -0.6 * (1 - Math.exp(bias / 0.6)))
}

/** Fuzz Face-style fuzz. Two germanium stages with feedback; the input's
 *  level matters (turn the source down and it cleans up), each unit's
 *  transistor gain differs (tolerances), and it runs 2× oversampled. */
export class FuzzDsp extends PedalDsp {
  private readonly pFuzz = this.pi('fuzz')
  private readonly pVol = this.pi('vol')
  private readonly pBias = this.pi('bias')
  private readonly pTone = this.pi('tone')
  private readonly hfe: number
  private prev = 0
  private lp = 0
  private lp2 = 0
  private readonly dc: DcBlock

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.hfe = this.tol(0.15)
    this.dc = new DcBlock(1 - 30 / fs)
  }

  private stage(x: number): number {
    const p = this.p
    const gain = (2 + p[this.pFuzz] * 60) * this.hfe
    const bias = (p[this.pBias] - 0.5) * 1.6
    const a = germanium(x * gain, bias)
    // starved bias: below a threshold the second transistor cuts off (sputter)
    const gate = p[this.pBias] < 0.25 ? Math.min(1, Math.abs(a) * (8 - p[this.pBias] * 30)) : 1
    return germanium(a * 3, bias * 0.5) * gate
  }

  protected wet(x: number): number {
    const v = x * PEDAL_IN
    // 2× oversampling: midpoint + sample, then average
    const y = (this.stage((v + this.prev) * 0.5) + this.stage(v)) * 0.5
    this.prev = v
    const p = this.p
    const k = 0.08 + p[this.pTone] * 0.6
    this.lp += (y - this.lp) * k
    this.lp2 += (this.lp - this.lp2) * k
    return this.dc.run(this.lp2) * 5 * p[this.pVol]
  }
}
