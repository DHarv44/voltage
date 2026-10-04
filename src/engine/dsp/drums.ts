import { Dsp } from './base'
import { Schmitt } from './cores'
import { ClapVoice, HatVoices, KickVoice, SnareVoice } from './drumVoices'

/** Trigger level from the ACCENT jack (0–10 V): unaccented hits sit at 60%. */
export const accentLevel = (v: number) => 0.6 + 0.4 * Math.min(1, Math.max(0, v / 10))

const LED_DECAY = 0.9993

export class KickDsp extends Dsp {
  private iTrig = this.ii('trig')
  private iAcc = this.ii('acc')
  private iTune = this.ii('tune')
  private pTune = this.pi('tune')
  private pDecay = this.pi('decay')
  private pPunch = this.pi('punch')
  private pDrive = this.pi('drive')
  private readonly trig = new Schmitt()
  private readonly voice = new KickVoice(this.fs)
  private readonly ttol = this.tol(0.02)

  tick(): void {
    const i = this.in
    const p = this.p
    if (this.trig.rise(i[this.iTrig])) {
      this.voice.trigger(accentLevel(i[this.iAcc]))
      this.led[0] = 1
    } else this.led[0] *= LED_DECAY
    const tune = p[this.pTune] * this.ttol * Math.pow(2, i[this.iTune])
    this.out[0] = 5 * this.voice.step(tune, p[this.pDecay], p[this.pPunch], p[this.pDrive])
  }
}

export class SnareDsp extends Dsp {
  private iTrig = this.ii('trig')
  private iAcc = this.ii('acc')
  private pTune = this.pi('tune')
  private pDecay = this.pi('decay')
  private pTone = this.pi('tone')
  private pSnappy = this.pi('snappy')
  private readonly trig = new Schmitt()
  private readonly voice = new SnareVoice(this.fs, this.rng)
  private readonly ttol = this.tol(0.02)

  tick(): void {
    const p = this.p
    if (this.trig.rise(this.in[this.iTrig])) {
      this.voice.trigger(accentLevel(this.in[this.iAcc]))
      this.led[0] = 1
    } else this.led[0] *= LED_DECAY
    this.out[0] = 5 * this.voice.step(p[this.pTune] * this.ttol, p[this.pTone], p[this.pSnappy], p[this.pDecay])
  }
}

export class ClapDsp extends Dsp {
  private iTrig = this.ii('trig')
  private iAcc = this.ii('acc')
  private pTone = this.pi('tone')
  private pDecay = this.pi('decay')
  private pSpread = this.pi('spread')
  private readonly trig = new Schmitt()
  private readonly voice = new ClapVoice(this.fs, this.rng)

  tick(): void {
    const p = this.p
    if (this.trig.rise(this.in[this.iTrig])) {
      this.voice.trigger(accentLevel(this.in[this.iAcc]))
      this.led[0] = 1
    } else this.led[0] *= LED_DECAY
    this.out[0] = 5 * this.voice.step(p[this.pTone], p[this.pDecay], p[this.pSpread])
  }
}

export class HatsDsp extends Dsp {
  private iCh = this.ii('ch')
  private iOh = this.ii('oh')
  private iAcc = this.ii('acc')
  private pTune = this.pi('tune')
  private pTone = this.pi('tone')
  private pChd = this.pi('chd')
  private pOhd = this.pi('ohd')
  private readonly trigCh = new Schmitt()
  private readonly trigOh = new Schmitt()
  private readonly voices = new HatVoices(this.fs, this.rng)

  tick(): void {
    const i = this.in
    const p = this.p
    const acc = accentLevel(i[this.iAcc])
    if (this.trigCh.rise(i[this.iCh])) {
      this.voices.triggerClosed(acc)
      this.led[0] = 1
    } else this.led[0] *= LED_DECAY
    if (this.trigOh.rise(i[this.iOh])) {
      this.voices.triggerOpen(acc)
      this.led[1] = 1
    } else this.led[1] *= LED_DECAY
    const v = this.voices
    v.step(p[this.pTune], p[this.pChd], p[this.pOhd], p[this.pTone])
    this.out[0] = 5 * v.ch
    this.out[1] = 5 * v.oh
    this.out[2] = 5 * (v.ch + v.oh)
  }
}
