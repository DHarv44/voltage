import type { ModuleSpec } from '../../modules/types'
import { Dsp } from './base'

/** Formant frequencies (Hz) of U O A E I (adult male), and their bandwidth Qs. */
export const F: number[][] = [
  [300, 870, 2240],
  [570, 840, 2410],
  [730, 1090, 2440],
  [530, 1840, 2480],
  [270, 2290, 3010],
]
export const GAINS = [1, 0.55, 0.3]

/** Zero-delay state-variable band-pass, retuned every sample (cheap: one tan). */
export class Formant {
  private ic1 = 0
  private ic2 = 0
  run(x: number, g: number, k: number): number {
    const a1 = 1 / (1 + g * (g + k))
    const v1 = a1 * this.ic1 + g * a1 * (x - this.ic2)
    const v2 = this.ic2 + g * v1
    this.ic1 = 2 * v1 - this.ic1
    this.ic2 = 2 * v2 - this.ic2
    return v1
  }
}

/** Talk box: the input excites a vocal tract. The vowel slides through the
 *  formant table, the jaw raises F1 and lets the sound out (closed = muffled
 *  hum), and the tube adds its own quarter-wave resonance. */
export class TalkBoxDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iVowel = this.ii('vowel')
  private readonly iOpen = this.ii('open')
  private readonly pVowel = this.pi('vowel')
  private readonly pOpen = this.pi('open')
  private readonly pReso = this.pi('reso')
  private readonly pTube = this.pi('tube')
  private readonly pLevel = this.pi('level')
  private readonly formants = [new Formant(), new Formant(), new Formant()]
  private readonly tube = new Formant()
  private vowel = 0.5
  private open = 0.7
  private lip = 0
  private readonly glide: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.glide = 1 - Math.exp(-1 / (0.02 * fs)) // tongue and jaw have mass
  }

  tick(): void {
    const p = this.p
    const tv = Math.min(1, Math.max(0, p[this.pVowel] + this.in[this.iVowel] / 10))
    const to = Math.min(1, Math.max(0, p[this.pOpen] + this.in[this.iOpen] / 10))
    this.vowel += (tv - this.vowel) * this.glide
    this.open += (to - this.open) * this.glide

    const pos = this.vowel * (F.length - 1)
    const i = Math.min(F.length - 2, Math.floor(pos))
    const f = pos - i
    const x = this.in[this.iIn] * 0.2
    const k = 1 / (4 + p[this.pReso] * 14)
    let y = 0
    for (let n = 0; n < 3; n++) {
      let hz = F[i][n] + (F[i + 1][n] - F[i][n]) * f
      if (n === 0) hz *= 0.7 + this.open * 0.5
      const g = Math.tan((Math.PI * Math.min(hz, this.fs * 0.45)) / this.fs)
      const kn = k * (n + 1) * 0.7
      y += this.formants[n].run(x, g, kn) * kn * GAINS[n] // ×k: unity peak gain at any Q
    }
    // Tube resonance (~1 m of hose) and the lips: closed mouth lets only lows through.
    const tg = Math.tan((Math.PI * 340) / this.fs)
    y += this.tube.run(x, tg, 0.3) * 0.3 * p[this.pTube] * 0.6
    const lipK = 0.02 + this.open * this.open * 0.7
    this.lip += (y - this.lip) * lipK
    this.out[0] = this.lip * (0.3 + this.open * 0.7) * 5 * 3 * p[this.pLevel]
  }
}
