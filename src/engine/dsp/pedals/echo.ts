import type { ModuleSpec } from '../../../modules/types'
import { DelayLine } from '../delayLine'
import { TAU } from '../util'
import { PEDAL_IN, PedalDsp } from './base'

/** Which playback heads each MODE position uses (bit 0 = head 1). */
const MODES = [0b001, 0b010, 0b100, 0b011, 0b110, 0b101, 0b111]
const MAX_S = 1.2

/** Space Echo-style tape echo. A loop of tape passes one record head and three
 *  playback heads spaced 1:2:3; REPEAT RATE is the motor speed, so turning it
 *  bends the pitch of the echoes in flight. The feedback path loses top and
 *  bottom and saturates on tape, so INTENSITY past ~1 self-oscillates musically.
 *  Bypass keeps the trails ringing (only the input is cut). */
export class EchoDsp extends PedalDsp {
  private readonly pRate = this.pi('rate')
  private readonly pFb = this.pi('fb')
  private readonly pHeads = this.pi('heads')
  private readonly pMix = this.pi('mix')
  private readonly iCv = this.ii('cv')
  private readonly line: DelayLine
  private speed = 0
  private lp = 0
  private hp = 0
  private echo = 0
  private wow = 0
  private flutter = 0
  private readonly motor: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.line = new DelayLine(Math.ceil(MAX_S * fs) + 8)
    this.motor = 1 - Math.exp(-1 / (0.25 * fs))
    this.speed = -1
  }

  protected wet(x: number): number {
    const p = this.p
    const rate = Math.min(1, Math.max(0, p[this.pRate] + this.in[this.iCv] / 10))
    const target = (0.065 + (1 - rate) * 0.28) * this.fs
    this.speed = this.speed < 0 ? target : this.speed + (target - this.speed) * this.motor
    this.wow = (this.wow + 0.6 / this.fs) % 1
    this.flutter = (this.flutter + 7.3 / this.fs) % 1
    const mod = 1 + 0.0015 * Math.sin(TAU * this.wow) + 0.0005 * Math.sin(TAU * this.flutter)

    const mask = MODES[Math.round(p[this.pHeads]) - 1] ?? 1
    let sum = 0
    let n = 0
    for (let h = 0; h < 3; h++)
      if (mask & (1 << h)) {
        sum += this.line.tapHermite(this.speed * (h + 1) * mod)
        n++
      }
    this.echo = sum / Math.sqrt(Math.max(1, n))

    // Feedback: worn heads lose highs and lows; tape saturates.
    this.lp += (this.echo - this.lp) * 0.35
    this.hp += (this.lp - this.hp) * 0.016
    const fb = (this.lp - this.hp) * p[this.pFb]
    this.line.write(Math.tanh(x * PEDAL_IN * this.mix + fb))
    return x
  }

  tick(): void {
    const x = this.in[this.iIn]
    this.engage()
    this.wet(x)
    this.out[0] = x + this.echo * 5 * this.p[this.pMix]
  }
}
