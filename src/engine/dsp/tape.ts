import { Dsp } from './base'
import { DelayLine } from './delayLine'
import { TAU, fastTanh } from './util'

const MAX_TIME = 1.5

/** Tape echo. Record: input + feedback, saturated like tape (soft compression).
 *  Playback: head bump (+low end around 90 Hz), high-frequency loss and hiss that
 *  grow with AGE; wow (slow, irregular) and flutter (fast) wobble the transport.
 *  TIME glides like a varispeed motor, bending the pitch of what's on the tape. */
export class TapeDsp extends Dsp {
  private iIn = this.ii('in')
  private iTime = this.ii('time')
  private pTime = this.pi('time')
  private pFb = this.pi('fb')
  private pMix = this.pi('mix')
  private pWow = this.pi('wow')
  private pAge = this.pi('age')

  private readonly line = new DelayLine(MAX_TIME * 1.05 * this.fs)
  private tSm = -1 // snaps to the TIME setting on the first sample, then glides
  private readonly kMotor = 1 - Math.exp(-1 / (0.25 * this.fs))
  private wowPh = this.rng.next()
  private flutPh = this.rng.next()
  private walk = 0
  private lp = 0
  private bumpLp = 0
  private dcX = 0
  private dcY = 0
  private readonly dcR = 1 - (TAU * 20) / this.fs

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    let target = p[this.pTime] * Math.pow(2, -this.in[this.iTime])
    target = target < 0.02 ? 0.02 : target > MAX_TIME ? MAX_TIME : target
    this.tSm = this.tSm < 0 ? target : this.tSm + (target - this.tSm) * this.kMotor

    const wow = p[this.pWow]
    this.wowPh += 0.5 / this.fs
    this.flutPh += 7.5 / this.fs
    if (this.wowPh >= 1) this.wowPh -= 1
    if (this.flutPh >= 1) this.flutPh -= 1
    this.walk += ((this.rng.next() - 0.5) * 0.02 - this.walk * 0.001) * 0.02
    const wobble = 1 + wow * (0.004 * Math.sin(TAU * this.wowPh) + 0.0008 * Math.sin(TAU * this.flutPh) + 0.3 * this.walk)

    const age = p[this.pAge]
    const raw = this.line.tapHermite(this.tSm * wobble * this.fs)
    // HF loss: one-pole lowpass from ~14 kHz (new tape) down to ~3 kHz (worn)
    const fc = 14000 * Math.pow(3000 / 14000, age)
    this.lp += (raw - this.lp) * (1 - Math.exp((-TAU * fc) / this.fs))
    // Head bump: a little extra low end around 90 Hz
    this.bumpLp += (this.lp - this.bumpLp) * ((TAU * 90) / this.fs)
    const played = this.lp + this.bumpLp * 0.25
    // DC block in the loop, hiss proportional to age
    this.dcY = played - this.dcX + this.dcR * this.dcY
    this.dcX = played
    const wet = this.dcY + (this.rng.next() - 0.5) * 0.02 * (0.2 + age)

    const rec = x + p[this.pFb] * wet
    this.line.write(6 * fastTanh((rec * (1 + age)) / 6) / (1 + 0.5 * age))

    const mix = p[this.pMix]
    this.out[0] = x * (1 - mix) + wet * mix
    this.out[1] = wet
  }
}
