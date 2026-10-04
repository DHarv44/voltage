import { Dsp } from './base'
import { rails } from './util'

const CH = 4
const QUARTER_PI = Math.PI / 4

/** Stereo mixer: equal-power pan (−3 dB centre), post-fader mono send,
 *  stereo return summed into the master bus. */
export class StereoMixDsp extends Dsp {
  private iIn = Array.from({ length: CH }, (_, c) => this.ii(`in${c + 1}`))
  private iRetL = this.ii('retL')
  private iRetR = this.ii('retR')
  private pLvl = Array.from({ length: CH }, (_, c) => this.pi(`lvl${c + 1}`))
  private pPan = Array.from({ length: CH }, (_, c) => this.pi(`pan${c + 1}`))
  private pSnd = Array.from({ length: CH }, (_, c) => this.pi(`snd${c + 1}`))
  private pRet = this.pi('ret')
  private pMaster = this.pi('master')

  tick(): void {
    const i = this.in
    const p = this.p
    let l = 0
    let r = 0
    let send = 0
    for (let c = 0; c < CH; c++) {
      const x = i[this.iIn[c]] * p[this.pLvl[c]]
      const a = (p[this.pPan[c]] + 1) * QUARTER_PI
      l += x * Math.cos(a)
      r += x * Math.sin(a)
      send += x * p[this.pSnd[c]]
    }
    const retL = i[this.iRetL]
    const retR = this.patched[this.iRetR] ? i[this.iRetR] : retL // R normalled to L
    const m = p[this.pMaster]
    this.out[0] = rails(send)
    this.out[1] = rails((l + retL * p[this.pRet]) * m)
    this.out[2] = rails((r + retR * p[this.pRet]) * m)
  }
}

/** Quad VCA mixer. Each channel: gain = LEVEL + CV/10 (linear, like a CA3080
 *  quad). A channel whose own output is patched drops out of the mix. */
export class VcaMixDsp extends Dsp {
  private iIn = Array.from({ length: CH }, (_, c) => this.ii(`in${c + 1}`))
  private iCv = Array.from({ length: CH }, (_, c) => this.ii(`cv${c + 1}`))
  private pLvl = Array.from({ length: CH }, (_, c) => this.pi(`lvl${c + 1}`))
  private oMix = this.oi('mix')

  tick(): void {
    const i = this.in
    let mix = 0
    for (let c = 0; c < CH; c++) {
      let g = this.p[this.pLvl[c]] + Math.max(0, i[this.iCv[c]] / 10)
      if (g > 1.2) g = 1.2
      const y = rails(i[this.iIn[c]] * (g + 0.0003))
      this.out[c] = y
      if (!this.outPatched[c]) mix += y
      this.led[c] = g
    }
    this.out[this.oMix] = rails(mix)
  }
}
