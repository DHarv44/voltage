import type { ModuleSpec } from '../../../modules/types'
import { LED_BLOCK, sceneBlock } from '../../../modules/specs/vision'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { Garden } from './garden'
import { Jelly } from './jelly'
import { Fireflies } from './fireflies'
import { Aurora } from './aurora'
import { Cymatics } from './cymatics'
import type { Creature, CreatureInput, CreatureOutput } from './creature'
import type { UiEvent } from '../../protocol'

/** A finger on one scene's glass (scene-space 0..1). */
class Finger {
  tap = false
  down = false
  x = 0.5
  y = 0.5
  /** Where the creature last saw it (for drag deltas). */
  seenX = 0.5
  seenY = 0.5
}

/** VISION VIEW: only a screen. The tank it shows runs in the linked module. */
export class VisionViewDsp extends Dsp {
  tick(): void {}
}

/** Creatures live at control rate: one step every BLOCK samples. */
const BLOCK = 32

/** VISION tank. Hosts one creature per scene, all alive at once at control
 *  rate (so linked VIEWs can watch any of them); the selected one drives the
 *  jacks, smoothed to audio rate so CV never steps audibly. */
export class VisionDsp extends Dsp {
  private readonly pScene = this.pi('scene')
  private readonly pRate = this.pi('rate')
  private readonly pHue = this.pi('hue')
  private readonly pGlow = this.pi('glow')
  private readonly pCount = this.pi('count')
  private readonly pSky = this.pi('sky')
  private readonly pTrees = this.pi('trees')
  private readonly pFlora = this.pi('flora')
  private readonly pBugs = this.pi('bugs')
  private readonly iTrig = this.ii('trig')
  private readonly iFeed = this.ii('feed')
  private readonly iGlow = this.ii('glow')
  private readonly iHue = this.ii('hue')
  private readonly iMove = this.ii('move')
  private readonly iRst = this.ii('rst')
  /** The glass as a touch pad (VISION only; VISION CORE has no glass: −1). */
  private readonly oTx = this.spec.outputs.findIndex((j) => j.id === 'tx')
  private readonly oTy = this.spec.outputs.findIndex((j) => j.id === 'ty')
  private readonly oTgate = this.spec.outputs.findIndex((j) => j.id === 'tgate')
  private scene = 0
  private readonly creatures: Creature[]
  private readonly trig = new Schmitt()
  private readonly rst = new Schmitt()
  private readonly ci: CreatureInput
  private readonly co: CreatureOutput = { gate: 0, sway: 0, grow: 0, light: 0 }
  /** Where the scenes not on the jacks put their outputs (nobody reads them). */
  private readonly idle: CreatureOutput = { gate: 0, sway: 0, grow: 0, light: 0 }
  /** Each scene's block of the LED channel (block 0 mirrors the selected one). */
  private readonly blocks: Float32Array[]
  /** Touches on the glass, one per scene (a VIEW can touch any scene). */
  private readonly fingers: Finger[]
  private n = 0
  private edge = false
  private feedEnv = 0
  private readonly envUp: number
  private readonly envDown: number
  private readonly glide: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.creatures = [new Jelly(this.rng), new Garden(this.rng), new Fireflies(this.rng), new Aurora(this.rng), new Cymatics(this.rng)]
    this.blocks = this.creatures.map((_, k) => this.led.subarray(sceneBlock(k), sceneBlock(k) + LED_BLOCK))
    this.fingers = this.creatures.map(() => new Finger())
    this.ci = {
      dt: BLOCK / fs, trig: false, trigPatched: false, held: false, feed: 0, feedPatched: false, glowCv: 0, hueV: 0, move: 0, rate: 0, hue: 0, glow: 0, count: 0.5,
      touch: { tap: false, touching: false, x: 0.5, y: 0.5, dx: 0, dy: 0 },
      opts: { sky: 3, trees: 2, flora: 0, bugs: 1 },
    }
    this.envUp = 1 - Math.exp(-1 / (0.01 * fs))
    this.envDown = 1 - Math.exp(-1 / (0.3 * fs))
    this.glide = 1 - Math.exp(-1 / (0.004 * fs))
  }

  /** Touch from a screen: name `touch<scene>`, x/y in that scene's space. */
  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface' || !ev.name.startsWith('touch')) return
    const f = this.fingers[Number(ev.name.slice(5))]
    if (!f) return
    if (ev.down) {
      if (!f.down) {
        f.tap = true
        f.seenX = ev.x
        f.seenY = ev.y
      }
      f.down = true
      f.x = ev.x
      f.y = ev.y
    } else f.down = false
  }

  tick(): void {
    const x = this.in
    // RST: every scene in the tank starts over (so the visuals can begin with the song)
    if (this.rst.rise(x[this.iRst])) for (let k = 0; k < this.creatures.length; k++) this.creatures[k].reset()
    if (this.trig.rise(x[this.iTrig])) this.edge = true
    const a = Math.abs(x[this.iFeed])
    this.feedEnv += (a - this.feedEnv) * (a > this.feedEnv ? this.envUp : this.envDown)

    if (++this.n >= BLOCK) {
      this.n = 0
      const ci = this.ci
      ci.trig = this.edge
      ci.trigPatched = this.patched[this.iTrig] === 1
      ci.held = this.trig.high
      ci.feed = this.feedEnv
      ci.feedPatched = this.patched[this.iFeed] === 1
      ci.glowCv = x[this.iGlow]
      ci.hueV = x[this.iHue]
      ci.move = x[this.iMove]
      ci.rate = this.p[this.pRate]
      ci.hue = this.p[this.pHue]
      ci.glow = this.p[this.pGlow]
      ci.count = this.p[this.pCount]
      ci.opts.sky = Math.round(this.p[this.pSky])
      ci.opts.trees = Math.round(this.p[this.pTrees])
      ci.opts.flora = Math.round(this.p[this.pFlora])
      ci.opts.bugs = Math.round(this.p[this.pBugs])
      this.edge = false
      // Every scene lives all the time (views may watch any of them); the
      // SCENE knob picks which one drives the jacks and the main glass.
      const scene = Math.min(this.creatures.length - 1, Math.max(0, Math.round(this.p[this.pScene])))
      this.scene = scene
      const t = ci.touch
      for (let k = 0; k < this.creatures.length; k++) {
        const f = this.fingers[k]
        t.tap = f.tap
        t.touching = f.down
        t.x = f.x
        t.y = f.y
        t.dx = f.x - f.seenX
        t.dy = f.y - f.seenY
        f.tap = false
        f.seenX = f.x
        f.seenY = f.y
        this.creatures[k].step(ci, k === scene ? this.co : this.idle, this.blocks[k])
      }
      this.led.copyWithin(0, sceneBlock(scene), sceneBlock(scene) + LED_BLOCK)
    }

    const o = this.out
    const co = this.co
    o[0] = co.gate // gates stay sharp
    o[1] += (co.sway - o[1]) * this.glide
    o[2] += (co.grow - o[2]) * this.glide
    o[3] += (co.light - o[3]) * this.glide
    // the finger on the scene driving the jacks: where it is (held when it lifts), and down or not
    if (this.oTx >= 0) {
      const f = this.fingers[this.scene]
      o[this.oTx] += (Math.max(0, Math.min(10, f.x * 10)) - o[this.oTx]) * this.glide
      o[this.oTy] += (Math.max(0, Math.min(10, f.y * 10)) - o[this.oTy]) * this.glide
      o[this.oTgate] = f.down ? 10 : 0
    }
  }
}
