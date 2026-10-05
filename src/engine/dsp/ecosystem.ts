import type { ModuleSpec } from '../../modules/types'
import { ECOL } from '../../modules/specs/ecosystem'
import { Dsp } from './base'
import { Schmitt } from './cores'

const CTRL = 64
const GATE_S = 0.01
/** Seconds after an extinction before a few predators wander back in. */
const IMMIGRATE_S = 3

/** Rosenzweig–MacArthur predator–prey: logistic prey, and predators that get
 *  full (a saturating appetite). Past the Hopf point this has a true limit
 *  cycle — boom and bust that neither dies away nor explodes — and the small
 *  random shocks keep each cycle a little different. */
export class EcosystemDsp extends Dsp {
  private readonly iFood = this.ii('food')
  private readonly iCull = this.ii('cull')
  private readonly pRate = this.pi('rate')
  private readonly pGrowth = this.pi('growth')
  private readonly pHunt = this.pi('hunt')
  private readonly pStarve = this.pi('starve')
  private prey = 0.5
  private pred = 0.2
  private trend = 0
  private peak = 0
  private trough = 1
  private readonly cull = new Schmitt()
  private boom = 0
  private crash = 0
  private extinct = 0
  private gone = -1
  private n = 0

  private step(dt: number): void {
    const p = this.p
    const t = dt * p[this.pRate] * 3
    if (this.cull.rise(this.in[this.iCull])) this.pred *= 0.4
    const K = Math.max(0.2, 2 * (1 + this.in[this.iFood] / 5)) // the meadow's carrying capacity
    const r = p[this.pGrowth]
    const a = 4 * p[this.pHunt] // attack rate
    const hnd = 0.5 // handling time: a full fox stops hunting
    const e = 0.6 // how much of a rabbit becomes fox
    const d = 0.5 * p[this.pStarve]
    const eaten = (a * this.prey) / (1 + a * hnd * this.prey)
    const noise = (this.rng.next() - 0.5) * 0.02 * Math.sqrt(t)
    const dPrey = (r * this.prey * (1 - this.prey / K) - eaten * this.pred) * t + noise * this.prey
    const dPred = (e * eaten * this.pred - d * this.pred) * t
    this.prey = Math.max(0.002, this.prey + dPrey)
    this.pred = Math.max(0, this.pred + dPred)

    // Peaks and troughs, with 10 % hysteresis so a wobble isn't a boom.
    if (this.trend >= 0) {
      this.peak = Math.max(this.peak, this.prey)
      if (this.prey < this.peak * 0.9) {
        if (this.peak > 0.2) this.boom = Math.round(GATE_S * this.fs)
        this.trend = -1
        this.trough = this.prey
      }
    } else {
      this.trough = Math.min(this.trough, this.prey)
      if (this.prey > this.trough * 1.1 + 0.01) {
        this.crash = Math.round(GATE_S * this.fs)
        this.trend = 1
        this.peak = this.prey
      }
    }

    // Extinction, then immigrants.
    if (this.pred < 0.002 && this.gone < 0) {
      this.pred = 0
      this.gone = 0
      this.extinct = Math.round(GATE_S * this.fs)
    }
    if (this.gone >= 0) {
      this.gone += dt
      if (this.gone > IMMIGRATE_S) {
        this.pred = 0.05
        this.gone = -1
      }
    }
  }

  tick(): void {
    if (++this.n >= CTRL) {
      this.n = 0
      this.step(CTRL / this.fs)
    }
    const o = this.out
    o[0] += (Math.min(10, this.prey * 5) - o[0]) * 0.01
    o[1] += (Math.min(10, this.pred * 5) - o[1]) * 0.01
    o[2] = this.boom > 0 ? 10 : 0
    o[3] = this.crash > 0 ? 10 : 0
    o[4] = this.extinct > 0 ? 10 : 0
    if (this.boom > 0) this.boom--
    if (this.crash > 0) this.crash--
    if (this.extinct > 0) this.extinct--
    this.led[ECOL.prey] = o[0] / 10
    this.led[ECOL.pred] = o[1] / 10
  }

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.prey = 0.3 + this.rng.next() * 0.4
  }
}
