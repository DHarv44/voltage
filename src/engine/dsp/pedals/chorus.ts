import type { ModuleSpec } from '../../../modules/types'
import { DelayLine } from '../delayLine'
import { PedalDsp } from './base'

const BASE_MS = 7
const SWING_MS = 4.5

/** BBD chorus pedal. One bucket-brigade line swept by a triangle LFO, its
 *  anti-alias filters darkening the wet signal, mixed with the dry. OUT B
 *  reads the same line with the LFO inverted for a stereo spread. */
export class ChorusDsp extends PedalDsp {
  private readonly pRate = this.pi('rate')
  private readonly pDepth = this.pi('depth')
  private readonly pMix = this.pi('mix')
  private readonly line: DelayLine
  private ph = 0
  private lpA = 0
  private lpA2 = 0
  private lpB = 0
  private lpB2 = 0
  private readonly ms: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.ms = fs / 1000
    this.line = new DelayLine(Math.ceil((BASE_MS + SWING_MS + 2) * this.ms))
    this.ph = this.rng.next()
  }

  private wetB = 0

  protected wet(x: number): number {
    const p = this.p
    this.line.write(x)
    this.ph = (this.ph + p[this.pRate] / this.fs) % 1
    const tri = this.ph < 0.5 ? this.ph * 4 - 1 : 3 - this.ph * 4
    const sw = SWING_MS * p[this.pDepth] * this.ms
    const a = this.line.tapHermite(BASE_MS * this.ms + tri * sw)
    const b = this.line.tapHermite(BASE_MS * this.ms - tri * sw)
    // BBD reconstruction filter (~8 kHz, two poles)
    const k = 0.62
    this.lpA += (a - this.lpA) * k
    this.lpA2 += (this.lpA - this.lpA2) * k
    this.lpB += (b - this.lpB) * k
    this.lpB2 += (this.lpB - this.lpB2) * k
    const mix = p[this.pMix]
    this.wetB = x * (1 - mix * 0.5) + this.lpB2 * mix
    return x * (1 - mix * 0.5) + this.lpA2 * mix
  }

  tick(): void {
    super.tick()
    const x = this.in[this.iIn]
    this.out[1] = x + (this.wetB - x) * this.mix
  }
}
