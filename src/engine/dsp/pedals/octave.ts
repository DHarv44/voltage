import type { ModuleSpec } from '../../../modules/types'
import { DcBlock, PedalDsp } from './base'

/** Octave pedal. UP: a full-wave rectifier (the Octavia trick) doubles the
 *  frequency. DOWN: a zero-crossing flip-flop divides by two (and again for
 *  2 OCT), its square wave shaped by the input envelope and low-passed, as on
 *  an OC-2. Monophonic tracking, like the real thing: chords glitch. */
export class OctaveDsp extends PedalDsp {
  private readonly pUp = this.pi('up')
  private readonly pDown = this.pi('down')
  private readonly pDry = this.pi('dry')
  private readonly pDown2 = this.pi('down2')
  private readonly dcUp: DcBlock
  private hp = 0
  private lpIn = 0
  private sign = false
  private ff1 = 1
  private ff2 = 1
  private env = 0
  private lpDown = 0
  private lpDown2 = 0
  private readonly envK: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.dcUp = new DcBlock(1 - 40 / fs)
    this.envK = 1 - Math.exp(-1 / (0.02 * fs))
  }

  protected wet(x: number): number {
    const p = this.p
    const up = this.dcUp.run(Math.abs(x)) * 1.6
    // Low-passed input for clean zero-crossing tracking.
    this.lpIn += (x - this.lpIn) * 0.05
    this.hp = this.lpIn
    const s = this.hp > 0.02 ? true : this.hp < -0.02 ? false : this.sign
    if (s && !this.sign) {
      this.ff1 = -this.ff1
      if (this.ff1 > 0) this.ff2 = -this.ff2
    }
    this.sign = s
    this.env += (Math.abs(x) - this.env) * this.envK
    this.lpDown += (this.ff1 * this.env - this.lpDown) * 0.02
    this.lpDown2 += (this.ff2 * this.env - this.lpDown2) * 0.012
    return x * p[this.pDry] + up * p[this.pUp] + this.lpDown * 1.5 * p[this.pDown] + this.lpDown2 * 1.5 * p[this.pDown2]
  }
}
