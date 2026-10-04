import { Dsp } from './base'
import { Schmitt } from './cores'
import { Resonator, Svf } from './drumVoices'
import { accentLevel } from './drums'
import { TAU, fastTanh } from './util'

const LED_DECAY = 0.9993
const decayCoef = (s: number, fs: number) => Math.exp(-4.6 / (Math.max(s, 0.005) * fs))

/** Tom/conga: a pinged resonator. TOM mode adds a pitch drop (the head
 *  stretching back after the hit) and a stick click; CONGA is tighter, with
 *  no sweep and a shorter, purer ring. */
export class TomDsp extends Dsp {
  private iTrig = this.ii('trig')
  private iAcc = this.ii('acc')
  private iTune = this.ii('tune')
  private pTune = this.pi('tune')
  private pDecay = this.pi('decay')
  private pSweep = this.pi('sweep')
  private pMode = this.pi('mode')
  private readonly trig = new Schmitt()
  private readonly res = new Resonator()
  private pitchEnv = 0
  private click = 0
  private readonly kPitch = Math.exp(-1 / (0.06 * this.fs))
  private readonly kClick = Math.exp(-1 / (0.0015 * this.fs))
  private readonly ttol = this.tol(0.02)

  tick(): void {
    const i = this.in
    const p = this.p
    const conga = p[this.pMode] >= 0.5
    if (this.trig.rise(i[this.iTrig])) {
      const lvl = accentLevel(i[this.iAcc])
      this.res.ping(lvl)
      this.pitchEnv = 1
      this.click = conga ? 0 : lvl * 0.4
      this.led[0] = 1
    } else this.led[0] *= LED_DECAY
    const sweep = conga ? 0 : p[this.pSweep]
    const f = p[this.pTune] * this.ttol * Math.pow(2, i[this.iTune]) * (1 + sweep * this.pitchEnv)
    this.pitchEnv *= this.kPitch
    const decay = conga ? p[this.pDecay] * 0.5 : p[this.pDecay]
    let y = this.res.step((TAU * f) / this.fs, decayCoef(decay, this.fs))
    y += (this.rng.next() * 2 - 1) * this.click
    this.click *= this.kClick
    this.out[0] = 5 * fastTanh(y * 1.2)
  }
}

const BELL_HZ = [587, 845]

/** 808 rimshot: two short bridged-T rings (≈455 Hz, ≈1.7 kHz) with a hard
 *  attack. 808 cowbell: two square waves through a bandpass, with a fast
 *  initial drop into a longer tail. */
export class PercDsp extends Dsp {
  private iRim = this.ii('rim')
  private iBell = this.ii('bell')
  private iAcc = this.ii('acc')
  private pR = this.pi('rtune')
  private pB = this.pi('btune')
  private pBd = this.pi('bdecay')
  private readonly tRim = new Schmitt()
  private readonly tBell = new Schmitt()
  private readonly r1 = new Resonator()
  private readonly r2 = new Resonator()
  private readonly bp = new Svf()
  private readonly ph = [this.rng.next(), this.rng.next()]
  private bellFast = 0
  private bellSlow = 0

  tick(): void {
    const i = this.in
    const p = this.p
    const acc = accentLevel(i[this.iAcc])
    if (this.tRim.rise(i[this.iRim])) {
      this.r1.ping(acc)
      this.r2.ping(acc * 0.8)
      this.led[0] = 1
    } else this.led[0] *= LED_DECAY
    if (this.tBell.rise(i[this.iBell])) {
      this.bellFast = acc
      this.bellSlow = acc * 0.35
      this.led[1] = 1
    } else this.led[1] *= LED_DECAY

    const fs = this.fs
    const rt = p[this.pR]
    const rim = this.r1.step((TAU * 455 * rt) / fs, decayCoef(0.025, fs)) + this.r2.step((TAU * 1667 * rt) / fs, decayCoef(0.02, fs))

    let sq = 0
    for (let k = 0; k < 2; k++) {
      this.ph[k] += (BELL_HZ[k] * p[this.pB]) / fs
      if (this.ph[k] >= 1) this.ph[k] -= 1
      sq += this.ph[k] < 0.5 ? 0.5 : -0.5
    }
    this.bp.process(sq, 2640 * p[this.pB], 1.4, fs)
    this.bellFast *= decayCoef(0.03, fs)
    this.bellSlow *= decayCoef(p[this.pBd], fs)
    const bell = this.bp.bp * (this.bellFast + this.bellSlow) * 2.2

    const o = this.out
    o[0] = 5 * fastTanh(rim * 1.5)
    o[1] = 5 * fastTanh(bell)
    o[2] = 0.6 * (o[0] + o[1])
  }
}
