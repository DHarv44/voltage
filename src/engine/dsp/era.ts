import { Dsp } from './base'
import { Converter, ERAS } from './sampling/converter'

/** ERA: the converter model on a cable (see the spec). */
export class EraDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iRcv = this.ii('rcv')
  private readonly oOut = this.oi('out')
  private readonly pEra = this.pi('era')
  private readonly pRate = this.pi('rate')
  private readonly pBits = this.pi('bits')
  private readonly pMix = this.pi('mix')
  private readonly conv = new Converter(this.fs)
  private count = 0

  tick(): void {
    const p = this.p
    // the settings change slowly: redo the filters now and then, not every sample
    if (this.count-- <= 0) {
      this.count = 64
      const e = ERAS[Math.max(0, Math.min(ERAS.length - 1, Math.round(p[this.pEra])))]
      const rate = Math.min(this.fs, Math.max(1000, e.rate * p[this.pRate] * Math.pow(2, this.in[this.iRcv])))
      this.conv.set(e, Math.round(rate / 50) * 50, Math.max(2, Math.min(16, e.bits + Math.round(p[this.pBits]))))
    }
    const x = this.in[this.iIn]
    const m = p[this.pMix]
    this.out[this.oOut] = x * (1 - m) + this.conv.run(x) * m
  }
}
