import { Dsp } from './base'
import { EnvCore, OscCore, Schmitt } from './cores'

/** Analog ADSR, 0–10 V, gate hysteresis and retrigger. */
export class AdsrDsp extends Dsp {
  private iGate = this.ii('gate')
  private iRt = this.ii('retrig')
  private oEnv = this.oi('env')
  private oInv = this.oi('inv')
  private pA = this.pi('a')
  private pD = this.pi('d')
  private pS = this.pi('s')
  private pR = this.pi('r')
  private readonly env = new EnvCore(this.fs, this.tol(0.05))
  private readonly rt = new Schmitt()

  tick(): void {
    const p = this.p
    const retrig = this.rt.rise(this.in[this.iRt])
    const v = this.env.step(this.in[this.iGate], retrig, p[this.pA], p[this.pD], p[this.pS], p[this.pR])
    this.out[this.oEnv] = v * 10
    this.out[this.oInv] = -v * 10
    this.led[0] = v
  }
}

/** Free-running LFO with ±5 V outputs; HI range reaches into audio for FM. */
export class LfoDsp extends Dsp {
  private iRate = this.ii('rate')
  private iReset = this.ii('reset')
  private oSin = this.oi('sin')
  private oTri = this.oi('tri')
  private oSaw = this.oi('saw')
  private oSqr = this.oi('sqr')
  private pRate = this.pi('rate')
  private pRange = this.pi('range')
  private readonly rtol = this.tol(0.04)
  private readonly osc = new OscCore()
  private readonly reset = new Schmitt()

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.osc.phase = this.rng.next()
  }

  tick(): void {
    const p = this.p
    const i = this.in
    const rate = p[this.pRate] * (p[this.pRange] >= 0.5 ? 50 : 1) * Math.pow(2, i[this.iRate]) * this.rtol
    if (this.reset.rise(i[this.iReset])) this.osc.phase = 0
    const osc = this.osc
    osc.step(Math.min(rate / this.fs, 0.45), 0.5)
    const o = this.out
    o[this.oSin] = osc.sin * 5
    o[this.oTri] = osc.tri * 5
    o[this.oSaw] = osc.saw * 5
    o[this.oSqr] = osc.sqr * 5
    this.led[0] = osc.sin
  }
}
