import { Dsp } from './base'
import { Schmitt } from './cores'

/** Envelope follower (full-wave rectifier + attack/release peak detector)
 *  and a comparator with hysteresis on the envelope (or on CMP if patched). */
export class FollowDsp extends Dsp {
  private iIn = this.ii('in')
  private iCmp = this.ii('cmp')
  private pGain = this.pi('gain')
  private pAtt = this.pi('att')
  private pRel = this.pi('rel')
  private pThr = this.pi('thr')
  private env = 0
  private high = false

  tick(): void {
    const p = this.p
    const x = Math.abs(this.in[this.iIn]) * p[this.pGain]
    const t = x > this.env ? p[this.pAtt] : p[this.pRel]
    this.env += (x - this.env) * (1 - Math.exp(-1 / (t * this.fs)))
    const env = Math.min(10, this.env)
    const v = this.patched[this.iCmp] ? this.in[this.iCmp] : env
    const thr = p[this.pThr]
    this.high = this.high ? v > thr - 0.2 : v > thr + 0.2
    this.out[0] = env
    this.out[1] = this.high ? 10 : 0
    this.led[0] = this.high ? 1 : 0
  }
}

/** Gate logic at a 1.2 V threshold (with hysteresis). FLIP toggles on each
 *  rising edge of A (a divide-by-two); RST forces it low. */
export class LogicDsp extends Dsp {
  private a = new Schmitt()
  private b = new Schmitt()
  private rst = new Schmitt()
  private flipState = false

  tick(): void {
    const aRise = this.a.rise(this.in[0])
    this.b.rise(this.in[1])
    if (this.rst.rise(this.in[2])) this.flipState = false
    else if (aRise) this.flipState = !this.flipState
    const A = this.a.high
    const B = this.b.high
    this.gate(0, A && B)
    this.gate(1, A || B)
    this.gate(2, A !== B)
    this.gate(3, !A)
    this.gate(4, this.flipState)
  }

  private gate(k: number, on: boolean): void {
    this.out[k] = on ? 10 : 0
    this.led[k] = on ? 1 : 0
  }
}

const enum F {
  Idle,
  Rise,
  Fall,
}

/** Maths-style function generator. A trigger runs a full rise to 10 V and fall
 *  back to 0 (an AD envelope); with CYCLE on (switch or high CYC gate) it loops
 *  as an LFO. With IN patched and no cycle running, the output slews toward IN
 *  at the rise/fall rates. RISE/FALL CV are exponential (+1 V = twice as fast). */
export class FuncDsp extends Dsp {
  private iTrig = this.ii('trig')
  private iIn = this.ii('in')
  private iCyc = this.ii('cyc')
  private iRise = this.ii('rise')
  private iFall = this.ii('fall')
  private pRise = this.pi('rise')
  private pFall = this.pi('fall')
  private pShape = this.pi('shape')
  private pLevel = this.pi('level')
  private pCycle = this.pi('cycle')
  private readonly trig = new Schmitt()
  private stage = F.Idle
  private v = 0 // 0..1
  private eoc = 0

  private curve(v: number): number {
    const s = this.p[this.pShape]
    if (Math.abs(s) < 0.02) return v
    const k = 4 * Math.abs(s)
    const norm = 1 / (Math.exp(k) - 1)
    return s > 0 ? (Math.exp(k * v) - 1) * norm : 1 - (Math.exp(k * (1 - v)) - 1) * norm
  }

  tick(): void {
    const i = this.in
    const p = this.p
    const riseStep = Math.pow(2, i[this.iRise]) / (Math.max(p[this.pRise], 0.0005) * this.fs)
    const fallStep = Math.pow(2, i[this.iFall]) / (Math.max(p[this.pFall], 0.0005) * this.fs)
    const cycling = p[this.pCycle] >= 0.5 || i[this.iCyc] > 1.2

    if (this.trig.rise(i[this.iTrig]) || (cycling && this.stage === F.Idle)) this.stage = F.Rise

    if (this.stage === F.Rise) {
      this.v += riseStep
      if (this.v >= 1) {
        this.v = 1
        this.stage = F.Fall
      }
    } else if (this.stage === F.Fall) {
      this.v -= fallStep
      if (this.v <= 0) {
        this.v = 0
        this.stage = F.Idle
        this.eoc = Math.round(0.005 * this.fs)
      }
    } else if (this.patched[this.iIn]) {
      // Slew limiter: chase IN at the rise/fall rates.
      const target = Math.min(1, Math.max(0, i[this.iIn] / 10))
      if (target > this.v) this.v = Math.min(target, this.v + riseStep)
      else this.v = Math.max(target, this.v - fallStep)
    }

    const y = this.curve(this.v) * 10 * p[this.pLevel]
    const o = this.out
    o[0] = y
    o[1] = this.stage === F.Fall ? 10 : 0
    o[2] = this.eoc > 0 ? 10 : 0
    o[3] = -y
    if (this.eoc > 0) this.eoc--
    this.led[0] = this.v
  }
}
