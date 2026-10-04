import { Dsp } from './base'
import { rails } from './util'

/** Linear/exponential VCA. LEVEL is an offset the CV adds to, so with nothing
 *  patched into CV the knob alone sets gain. A tiny CV bleed is left in, as on hardware. */
export class VcaDsp extends Dsp {
  private iIn = this.ii('in')
  private iCv = this.ii('cv')
  private oOut = this.oi('out')
  private pGain = this.pi('gain')
  private pCv = this.pi('cv')
  private pResp = this.pi('resp')
  private static readonly EXP_NORM = 1 / (Math.exp(4) - 1)

  tick(): void {
    const p = this.p
    const cv = this.patched[this.iCv] ? Math.max(0, this.in[this.iCv] / 10) * p[this.pCv] : 0
    let x = p[this.pGain] + cv
    if (x > 1.2) x = 1.2
    const g = p[this.pResp] >= 0.5 ? (Math.exp(4 * x) - 1) * VcaDsp.EXP_NORM : x
    this.out[this.oOut] = rails(this.in[this.iIn] * (g + 0.0003))
    this.led[0] = g
  }
}

export class MixerDsp extends Dsp {
  private iIns = [this.ii('in1'), this.ii('in2'), this.ii('in3'), this.ii('in4')]
  private pLv = [this.pi('l1'), this.pi('l2'), this.pi('l3'), this.pi('l4')]
  private pMaster = this.pi('master')
  private oOut = this.oi('out')
  private oInv = this.oi('inv')

  tick(): void {
    const i = this.in
    const p = this.p
    let sum = 0
    for (let c = 0; c < 4; c++) sum += i[this.iIns[c]] * p[this.pLv[c]]
    const v = rails(sum * p[this.pMaster])
    this.out[this.oOut] = v
    this.out[this.oInv] = -v
  }
}

/** Two buffered 1→3 mults. B's input jack is normalled to A's. */
export class MultDsp extends Dsp {
  private iA = this.ii('a')
  private iB = this.ii('b')

  tick(): void {
    const a = this.in[this.iA]
    const b = this.patched[this.iB] ? this.in[this.iB] : a
    const o = this.out
    o[0] = o[1] = o[2] = a
    o[3] = o[4] = o[5] = b
  }
}

/** White (flat), pink (−3 dB/oct, Kellet filter) and red (−6 dB/oct, leaky integrator). */
export class NoiseDsp extends Dsp {
  private b = new Float64Array(7)
  private red = 0

  tick(): void {
    const w = this.rng.next() * 2 - 1
    const b = this.b
    b[0] = 0.99886 * b[0] + w * 0.0555179
    b[1] = 0.99332 * b[1] + w * 0.0750759
    b[2] = 0.969 * b[2] + w * 0.153852
    b[3] = 0.8665 * b[3] + w * 0.3104856
    b[4] = 0.55 * b[4] + w * 0.5329522
    b[5] = -0.7616 * b[5] - w * 0.016898
    const pink = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362) * 0.11
    b[6] = w * 0.115926
    this.red = (this.red + 0.02 * w) / 1.02
    this.out[0] = w * 5
    this.out[1] = pink * 5
    this.out[2] = this.red * 3.5 * 5
  }
}
