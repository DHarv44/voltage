import { Dsp } from './base'
import { AudioOutCore } from './cores'

const FLOOR_DB = 48

/** Monitor controller: AC-coupled stereo output with MONO fold-down (to check
 *  phase/mono compatibility), DIM (−20 dB) and MUTE, plus VU meters on a
 *  −48…0 dBFS scale and clip lights that hold for ~1 s. */
export class MonitorDsp extends Dsp {
  sink = true
  private iL = this.ii('l')
  private iR = this.ii('r')
  private pVol = this.pi('vol')
  private pMono = this.pi('mono')
  private pDim = this.pi('dim')
  private pMute = this.pi('mute')
  private readonly left = new AudioOutCore(this.fs)
  private readonly right = new AudioOutCore(this.fs)
  private readonly clipHold = Math.round(this.fs)
  private clipL = 0
  private clipR = 0

  tick(): void {
    const p = this.p
    let l = this.in[this.iL]
    let r = this.patched[this.iR] ? this.in[this.iR] : l
    if (p[this.pMono] >= 0.5) l = r = 0.5 * (l + r)
    const gain = p[this.pMute] >= 0.5 ? 0 : p[this.pDim] >= 0.5 ? 0.1 : 1
    const sl = this.left.process(l, p[this.pVol]) * gain
    const sr = this.right.process(r, p[this.pVol]) * gain
    this.audioL = sl
    this.audioR = sr
    if (Math.abs(sl) > 0.98) this.clipL = this.clipHold
    if (Math.abs(sr) > 0.98) this.clipR = this.clipHold
    this.led[0] = this.vu(this.left.peak * gain)
    this.led[1] = this.vu(this.right.peak * gain)
    this.led[2] = this.clipL > 0 ? 1 : 0
    this.led[3] = this.clipR > 0 ? 1 : 0
    if (this.clipL > 0) this.clipL--
    if (this.clipR > 0) this.clipR--
  }

  /** Peak level → meter position on a −48…0 dBFS scale. */
  private vu(pk: number): number {
    return Math.max(0, (20 * Math.log10(pk + 1e-9) + FLOOR_DB) / FLOOR_DB)
  }
}
