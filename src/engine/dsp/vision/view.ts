import { Dsp } from '../base'
import { VisionDsp } from './index'

/** VISION VIEW: a screen onto a linked tank, and the jacks of the scene it
 *  shows. The scenes all live in the tank (through the LINK cable it reads the
 *  tank's per-scene outputs and fingers); SCENE 0 (= CORE) follows the tank's
 *  OUT knob, 1… pick a scene of its own. Unlinked, everything rests at 0 V. */
export class VisionViewDsp extends Dsp {
  private readonly pScene = this.pi('scene')
  private readonly iLink = this.ii('link')
  private readonly oDepth = this.oi('depth')
  private readonly oTx = this.oi('tx')
  private readonly oTy = this.oi('ty')
  private readonly oTgate = this.oi('tgate')
  private readonly glide = 1 - Math.exp(-1 / (0.004 * this.fs))

  tick(): void {
    const o = this.out
    const src = this.srcMod[this.iLink]
    if (!(src instanceof VisionDsp)) {
      o.fill(0)
      this.led[0] = 0
      return
    }
    const pick = Math.round(this.p[this.pScene])
    const k = pick <= 0 ? src.scene : Math.min(src.outs.length - 1, pick - 1)
    const s = src.outs[k]
    const f = src.fingers[k]
    const g = this.glide
    o[0] = s.gate // gates stay sharp
    o[1] += (s.sway - o[1]) * g
    o[2] += (s.grow - o[2]) * g
    o[3] += (s.light - o[3]) * g
    o[this.oDepth] += (s.depth - o[this.oDepth]) * g
    o[this.oTx] += (Math.max(0, Math.min(10, f.x * 10)) - o[this.oTx]) * g
    o[this.oTy] += (Math.max(0, Math.min(10, f.y * 10)) - o[this.oTy]) * g
    o[this.oTgate] = f.down ? 10 : 0
    this.led[0] = s.gate > 0 ? 1 : 0
  }
}
