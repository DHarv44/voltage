import type { ModuleSpec } from '../../../modules/types'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { Garden } from './flower'
import { Jelly } from './jelly'
import { Fireflies } from './fireflies'
import { Aurora } from './aurora'
import { Cymatics } from './cymatics'
import type { Creature, CreatureInput, CreatureOutput } from './creature'

/** Creatures live at control rate: one step every BLOCK samples. */
const BLOCK = 32

/** VISION tank. Hosts one creature per scene (each keeps its own life when you
 *  switch away), steps the selected one at control rate, and smooths its
 *  outputs to audio rate so CV never steps audibly. */
export class VisionDsp extends Dsp {
  private readonly pScene = this.pi('scene')
  private readonly pRate = this.pi('rate')
  private readonly pHue = this.pi('hue')
  private readonly pGlow = this.pi('glow')
  private readonly iTrig = this.ii('trig')
  private readonly iFeed = this.ii('feed')
  private readonly iGlow = this.ii('glow')
  private readonly iHue = this.ii('hue')
  private readonly iMove = this.ii('move')
  private readonly creatures: Creature[]
  private readonly trig = new Schmitt()
  private readonly ci: CreatureInput
  private readonly co: CreatureOutput = { gate: 0, sway: 0, grow: 0, light: 0 }
  private n = 0
  private edge = false
  private feedEnv = 0
  private readonly envUp: number
  private readonly envDown: number
  private readonly glide: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.creatures = [new Jelly(this.rng), new Garden(this.rng), new Fireflies(this.rng), new Aurora(this.rng), new Cymatics(this.rng)]
    this.ci = { dt: BLOCK / fs, trig: false, trigPatched: false, feed: 0, feedPatched: false, glowCv: 0, hueV: 0, move: 0, rate: 0, hue: 0, glow: 0 }
    this.envUp = 1 - Math.exp(-1 / (0.01 * fs))
    this.envDown = 1 - Math.exp(-1 / (0.3 * fs))
    this.glide = 1 - Math.exp(-1 / (0.004 * fs))
  }

  tick(): void {
    const x = this.in
    if (this.trig.rise(x[this.iTrig])) this.edge = true
    const a = Math.abs(x[this.iFeed])
    this.feedEnv += (a - this.feedEnv) * (a > this.feedEnv ? this.envUp : this.envDown)

    if (++this.n >= BLOCK) {
      this.n = 0
      const ci = this.ci
      ci.trig = this.edge
      ci.trigPatched = this.patched[this.iTrig] === 1
      ci.feed = this.feedEnv
      ci.feedPatched = this.patched[this.iFeed] === 1
      ci.glowCv = x[this.iGlow]
      ci.hueV = x[this.iHue]
      ci.move = x[this.iMove]
      ci.rate = this.p[this.pRate]
      ci.hue = this.p[this.pHue]
      ci.glow = this.p[this.pGlow]
      this.edge = false
      const scene = Math.min(this.creatures.length - 1, Math.max(0, Math.round(this.p[this.pScene])))
      this.creatures[scene].step(ci, this.co, this.led)
    }

    const o = this.out
    const co = this.co
    o[0] = co.gate // gates stay sharp
    o[1] += (co.sway - o[1]) * this.glide
    o[2] += (co.grow - o[2]) * this.glide
    o[3] += (co.light - o[3]) * this.glide
  }
}
