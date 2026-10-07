import { Dsp } from './base'
import { CONSOLE_CH } from '../../modules/specs/mixbus'
import { TAU, rails } from './util'

/** Tilt EQ hinge (Hz) and range (±6 dB each way). */
const HINGE = 800
const TILT = 0.69 // ln(10^(6/20))
const DUCK_ATTACK_S = 0.002

/** e^x for |x| ≤ 0.7, cheap enough for every channel every sample. */
const expSmall = (x: number) => 1 + x * (1 + x * (0.5 + x * (1 / 6)))

/** CONSOLE: six channel strips into a stereo bus. Each strip: TONE (tilt EQ
 *  about 800 Hz), DUCK (how far the sidechain pulls it down), LEVEL, MUTE,
 *  equal-power PAN, and a post-fader SEND. The sidechain follows DUCK in:
 *  quick to duck, back up over DUCK REL. */
export class ConsoleDsp extends Dsp {
  private iIn = Array.from({ length: CONSOLE_CH }, (_, i) => this.ii(`in${i + 1}`))
  private iSc = this.ii('sc')
  private iRetL = this.ii('retL')
  private iRetR = this.ii('retR')
  private oSend = this.oi('send')
  private oL = this.oi('l')
  private oR = this.oi('r')
  private pTone = Array.from({ length: CONSOLE_CH }, (_, i) => this.pi(`tone${i + 1}`))
  private pPan = Array.from({ length: CONSOLE_CH }, (_, i) => this.pi(`pan${i + 1}`))
  private pSnd = Array.from({ length: CONSOLE_CH }, (_, i) => this.pi(`snd${i + 1}`))
  private pDuck = Array.from({ length: CONSOLE_CH }, (_, i) => this.pi(`duck${i + 1}`))
  private pLvl = Array.from({ length: CONSOLE_CH }, (_, i) => this.pi(`lvl${i + 1}`))
  private pMute = Array.from({ length: CONSOLE_CH }, (_, i) => this.pi(`mute${i + 1}`))
  private pRel = this.pi('rel')
  private pRet = this.pi('ret')
  private pMaster = this.pi('master')

  private readonly lp = new Float64Array(CONSOLE_CH)
  private readonly hingeK = 1 - Math.exp((-TAU * HINGE) / this.fs)
  private readonly attK = 1 - Math.exp(-1 / (DUCK_ATTACK_S * this.fs))
  private duck = 0

  tick(): void {
    const i = this.in
    const p = this.p

    // the sidechain: a trigger or the kick itself, 5 V = all the way down
    let key = Math.abs(i[this.iSc]) / 5
    if (key > 1) key = 1
    if (key > this.duck) this.duck += (key - this.duck) * this.attK
    else this.duck *= Math.exp(-4.6 / (p[this.pRel] * this.fs))

    let l = 0
    let r = 0
    let send = 0
    for (let c = 0; c < CONSOLE_CH; c++) {
      if (!this.patched[this.iIn[c]] || p[this.pMute[c]] >= 0.5) continue
      const x = i[this.iIn[c]]
      this.lp[c] += (x - this.lp[c]) * this.hingeK
      const t = p[this.pTone[c]] * TILT
      const eq = this.lp[c] * expSmall(-t) + (x - this.lp[c]) * expSmall(t)
      const y = eq * p[this.pLvl[c]] * (1 - p[this.pDuck[c]] * this.duck)
      const pan = (p[this.pPan[c]] + 1) * 0.5
      l += y * Math.sqrt(1 - pan)
      r += y * Math.sqrt(pan)
      send += y * p[this.pSnd[c]]
    }
    const retL = i[this.iRetL]
    const retR = this.patched[this.iRetR] ? i[this.iRetR] : retL
    const m = p[this.pMaster]
    this.out[this.oL] = rails((l + retL * p[this.pRet]) * m * 1.25)
    this.out[this.oR] = rails((r + retR * p[this.pRet]) * m * 1.25)
    this.out[this.oSend] = rails(send)
    this.led[0] = this.duck
  }
}
