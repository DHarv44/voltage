import type { ModuleSpec } from '../../../modules/types'
import { PEDAL_IN, PedalDsp } from './base'

/** Inductor wah. A resonant band-pass (the inductor/cap tank) sweeps
 *  ~350 Hz → 2.2 kHz with the treadle; a little low-pass leaks through as on
 *  the real circuit. AUTO swaps the foot for an envelope follower. */
export class WahDsp extends PedalDsp {
  private readonly pPos = this.pi('pos')
  private readonly pQ = this.pi('q')
  private readonly pMode = this.pi('mode')
  private readonly pSens = this.pi('sens')
  private readonly iCv = this.ii('cv')
  private ic1 = 0
  private ic2 = 0
  private env = 0
  private pos = 0.4
  private readonly up: number
  private readonly down: number
  private readonly glide: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.up = 1 - Math.exp(-1 / (0.008 * fs))
    this.down = 1 - Math.exp(-1 / (0.18 * fs))
    this.glide = 1 - Math.exp(-1 / (0.015 * fs)) // the treadle's rack-and-pinion has mass
  }

  protected wet(x: number): number {
    const p = this.p
    const a = Math.abs(x)
    this.env += (a - this.env) * (a > this.env ? this.up : this.down)
    const auto = p[this.pMode] >= 0.5
    const target = auto ? Math.min(1, this.env * (0.1 + p[this.pSens] * 0.9)) : p[this.pPos] + this.in[this.iCv] / 10
    this.pos += (Math.min(1, Math.max(0, target)) - this.pos) * this.glide

    // Simper SVF band-pass.
    const fc = 350 * Math.pow(2200 / 350, this.pos)
    const g = Math.tan((Math.PI * fc) / this.fs)
    const k = 1 / p[this.pQ]
    const v = x * PEDAL_IN
    const a1 = 1 / (1 + g * (g + k))
    const v3 = v - this.ic2
    const v1 = a1 * this.ic1 + g * a1 * v3
    const v2 = this.ic2 + g * v1
    this.ic1 = 2 * v1 - this.ic1
    this.ic2 = 2 * v2 - this.ic2
    // the wah's output stage makes up the level the narrow band-pass removes
    return (v1 * 1.6 + v2 * 0.15) * 15 * Math.sqrt(k * 2)
  }
}
