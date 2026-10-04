import type { ModuleSpec } from '../../modules/types'
import { BOWLL } from '../../modules/specs/bowl'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { Mode } from './modal'
import { TAU } from './util'

/** Bowl modes (ratios measured on Himalayan bowls are roughly these). */
const RATIOS = [1, 2.71, 5.15, 8.43, 12.6]
const AMPS = [1, 0.6, 0.35, 0.2, 0.1]
const DECAYS = [1, 0.6, 0.4, 0.25, 0.15]
/** How much each mode is driven by rubbing (the fundamental sings). */
const RUB_GAIN = [1, 0.12, 0.04, 0, 0]
/** Rubbing speed above which the puja chatters on a loud bowl (rev/s). */
const CHATTER_SPEED = 1.6
const CTRL = 32

export class BowlDsp extends Dsp {
  private readonly iStrike = this.ii('strike')
  private readonly iRub = this.ii('rub')
  private readonly pPitch = this.pi('pitch')
  private readonly pWater = this.pi('water')
  private readonly pDecay = this.pi('decay')
  private readonly pLevel = this.pi('level')
  /** Two modes per partial: the bowl's slight asymmetry splits each one. */
  private readonly modes: Mode[]
  private readonly split: number[]
  private readonly strike = new Schmitt()
  private uiRub = 0
  private uiAge = 1
  private rub = 0
  private n = CTRL
  private wobble = 0
  private seed = 99
  private chatter = 0
  private env = 0
  private readonly rubK: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.modes = RATIOS.flatMap(() => [new Mode(), new Mode()])
    this.split = RATIOS.map(() => 0.002 + Math.abs(this.rng.gauss()) * 0.002)
    this.rubK = 1 - Math.exp(-1 / (0.05 * fs))
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'rub') {
      this.uiRub = ev.down ? Math.min(6, Math.abs(ev.x)) : 0
      this.uiAge = 0
    } else if (ev.name === 'strike' && ev.down) this.hit(Math.min(1, Math.max(0.1, ev.x)))
  }

  private hit(vel: number): void {
    for (let k = 0; k < RATIOS.length; k++) {
      this.modes[k * 2].strike(vel * AMPS[k] * 0.3)
      this.modes[k * 2 + 1].strike(vel * AMPS[k] * 0.3)
    }
  }

  private noise(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
    return this.seed / 2147483648
  }

  tick(): void {
    const p = this.p
    if (++this.n >= CTRL) {
      this.n = 0
      // Water lowers the modes and makes them waver as it sloshes.
      const water = p[this.pWater]
      this.wobble += (CTRL / this.fs) * 3.5 * TAU
      const f0 = p[this.pPitch] * (1 - water * 0.12) * (1 + water * 0.004 * Math.sin(this.wobble) * Math.min(1, this.env * 4))
      for (let k = 0; k < RATIOS.length; k++) {
        const d = p[this.pDecay] * DECAYS[k]
        this.modes[k * 2].tune(f0 * RATIOS[k], d, this.fs)
        this.modes[k * 2 + 1].tune(f0 * RATIOS[k] * (1 + this.split[k]), d, this.fs)
      }
    }
    if (this.strike.rise(this.in[this.iStrike])) this.hit(0.8)

    // The hand stops if no pointer events arrive for a moment.
    this.uiAge += 1 / this.fs
    const hand = this.uiAge < 0.08 ? this.uiRub : 0
    const target = Math.max(hand, this.patched[this.iRub] ? Math.max(0, this.in[this.iRub]) / 2 : 0)
    this.rub += (target - this.rub) * this.rubK

    // Stick-slip: the puja's friction pushes in step with the rim's own motion
    // (negative damping) until the bowl sings at the level the speed sustains.
    const m0 = this.modes[0]
    const amp = Math.sqrt(m0.energy)
    if (this.rub > 0.02) {
      const sustain = Math.min(1, this.rub * 0.45)
      const push = this.rub * 0.00002 * Math.max(0, 1 - amp / sustain)
      const friction = Math.tanh(m0.im * 60) * push + this.noise() * this.rub * 0.00002
      for (let k = 0; k < RATIOS.length; k++) {
        if (!RUB_GAIN[k]) continue
        this.modes[k * 2].drive(friction * RUB_GAIN[k])
        this.modes[k * 2 + 1].drive(friction * RUB_GAIN[k] * 0.8)
      }
    }
    // Too fast on a loud bowl: the puja bounces off the rim.
    this.chatter = this.rub > CHATTER_SPEED && amp > 0.2 && this.noise() > 0.97 ? (this.rub - CHATTER_SPEED) * amp * 0.4 : this.chatter * 0.9

    let y = 0
    for (const m of this.modes) y += m.step()
    y += this.chatter * this.noise()
    this.env += (amp - this.env) * 0.001
    this.out[0] = Math.tanh(y * 1.5) * 5 * p[this.pLevel]
    this.out[1] = Math.min(10, this.env * 10)
    this.led[BOWLL.level] = Math.min(1, this.env * 1.5)
    this.led[BOWLL.rub] = this.rub
    this.led[BOWLL.chatter] = Math.min(1, this.chatter * 5)
  }
}
