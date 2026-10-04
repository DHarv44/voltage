import { Dsp } from './base'
import { DelayLine } from './delayLine'
import { TAU, fastTanh, rails } from './util'

const STAGES = 6

/** Six first-order allpass stages swept together (an OTA/JFET phaser), with
 *  feedback around the chain and the wet signal mixed with dry to make the notches. */
export class PhaserDsp extends Dsp {
  private iIn = this.ii('in')
  private iCv = this.ii('cv')
  private pRate = this.pi('rate')
  private pDepth = this.pi('depth')
  private pCenter = this.pi('center')
  private pFb = this.pi('fb')
  private pMix = this.pi('mix')
  private readonly x1 = new Float64Array(STAGES)
  private readonly y1 = new Float64Array(STAGES)
  private lfo = this.rng.next()
  private last = 0

  tick(): void {
    const p = this.p
    this.lfo += p[this.pRate] / this.fs
    if (this.lfo >= 1) this.lfo -= 1
    const sweep = this.patched[this.iCv] ? this.in[this.iCv] / 5 : Math.sin(TAU * this.lfo)
    const f = Math.min(p[this.pCenter] * Math.pow(2, 2 * p[this.pDepth] * sweep), this.fs * 0.45)
    const t = Math.tan((Math.PI * f) / this.fs)
    const a = (t - 1) / (t + 1)

    const x = this.in[this.iIn]
    let s = fastTanh((x / 5 + p[this.pFb] * this.last) * 0.8) * 5 // feedback saturates gently
    for (let k = 0; k < STAGES; k++) {
      const y = a * s + this.x1[k] - a * this.y1[k]
      this.x1[k] = s
      this.y1[k] = y
      s = y
    }
    this.last = s / 5
    // MIX 100% = equal dry and wet, where the notches cancel completely.
    const mix = p[this.pMix] * 0.5
    this.out[0] = rails(x * (1 - mix) + s * mix)
    this.led[0] = sweep
  }
}

const BASE_MS = [6.5, 8.5, 10.5]

/** Solina-style ensemble: three BBD lines around ~8 ms, each modulated by a slow
 *  (0.6 Hz) + fast (6 Hz) LFO pair, the three lines 120° apart. L and R take
 *  different mixes of the lines, which is what makes it wide and shimmering. */
export class EnsembleDsp extends Dsp {
  private iIn = this.ii('in')
  private pRate = this.pi('rate')
  private pDepth = this.pi('depth')
  private pMix = this.pi('mix')
  private readonly lines = BASE_MS.map(() => new DelayLine(0.03 * this.fs))
  private slow = 0
  private fast = 0
  private readonly lp = new Float64Array(3)
  private readonly kLp = 1 - Math.exp((-TAU * 8000) / this.fs)
  private readonly taps = new Float64Array(3)

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    this.slow += (0.6 * p[this.pRate]) / this.fs
    this.fast += (6 * p[this.pRate]) / this.fs
    if (this.slow >= 1) this.slow -= 1
    if (this.fast >= 1) this.fast -= 1
    const depth = p[this.pDepth]
    for (let k = 0; k < 3; k++) {
      const ph = k / 3
      const mod = 1.6 * Math.sin(TAU * (this.slow + ph)) + 0.35 * Math.sin(TAU * (this.fast + ph))
      const d = (BASE_MS[k] + depth * mod) * 0.001 * this.fs
      this.lines[k].write(x)
      this.lp[k] += (this.lines[k].tapLin(d) - this.lp[k]) * this.kLp // BBD bandwidth
      this.taps[k] = this.lp[k]
    }
    const t = this.taps
    const wetL = (t[0] + 0.6 * t[1] + 0.2 * t[2]) / 1.8
    const wetR = (0.2 * t[0] + 0.6 * t[1] + t[2]) / 1.8
    const mix = p[this.pMix]
    this.out[0] = x * (1 - mix) + wetL * mix * 1.3
    this.out[1] = x * (1 - mix) + wetR * mix * 1.3
  }
}
