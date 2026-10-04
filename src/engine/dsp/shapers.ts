import { Dsp } from './base'
import { Schmitt } from './cores'
import { rails } from './util'

const HALF_PI = Math.PI / 2

/** Sine wavefolder with first-order antiderivative anti-aliasing (ADAA):
 *  the output is the average of sin() over each sample step, which removes
 *  most fold aliasing without oversampling. */
export class FolderDsp extends Dsp {
  private iIn = this.ii('in')
  private iCv = this.ii('cv')
  private pFold = this.pi('fold')
  private pBias = this.pi('bias')
  private pCv = this.pi('cv')
  private uPrev = 0

  tick(): void {
    const p = this.p
    const gain = p[this.pFold] * Math.pow(2, (this.in[this.iCv] * p[this.pCv]) / 2.5)
    const u = ((this.in[this.iIn] / 5) * gain + p[this.pBias]) * HALF_PI
    const du = u - this.uPrev
    const y = Math.abs(du) > 1e-6 ? (Math.cos(this.uPrev) - Math.cos(u)) / du : Math.sin(0.5 * (u + this.uPrev))
    this.uPrev = u
    this.out[0] = y * 5
  }
}

/** Sample & hold. Unpatched input samples internal white noise. The hold
 *  capacitor leaks slowly (~30 s time constant), like real hardware. */
export class SampleHoldDsp extends Dsp {
  private iIn = this.ii('in')
  private iTrig = this.ii('trig')
  private readonly trig = new Schmitt()
  private readonly leak = Math.exp(-1 / (30 * this.fs))
  private held = 0

  tick(): void {
    if (this.trig.rise(this.in[this.iTrig]))
      this.held = this.patched[this.iIn] ? this.in[this.iIn] : (this.rng.next() * 2 - 1) * 5
    else this.held *= this.leak
    this.out[0] = this.held
    this.led[0] = this.held / 5
  }
}

/** Slew limiter: LIN = constant rate (time to travel 10 V), EXP = RC lag. */
export class SlewDsp extends Dsp {
  private pRise = this.pi('rise')
  private pFall = this.pi('fall')
  private pShape = this.pi('shape')
  private v = 0

  tick(): void {
    const x = this.in[0]
    const p = this.p
    const up = x > this.v
    const time = Math.max(up ? p[this.pRise] : p[this.pFall], 0.0005)
    if (p[this.pShape] >= 0.5) {
      this.v += (x - this.v) * (1 - Math.exp(-2 / (time * this.fs)))
    } else {
      const max = 10 / (time * this.fs)
      const d = x - this.v
      this.v += d > max ? max : d < -max ? -max : d
    }
    this.out[0] = this.v
  }
}

/** Semitones of each QUANT_SCALES entry. */
export const SCALES: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 2, 4, 7, 9],
  [0, 3, 5, 6, 7, 10],
]

/** 1V/oct quantizer with hysteresis (no chatter at note boundaries).
 *  With CLK patched it only updates on clock edges (sample-and-quantize). */
export class QuantizerDsp extends Dsp {
  private iIn = this.ii('in')
  private iClk = this.ii('clk')
  private pScale = this.pi('scale')
  private pTrans = this.pi('trans')
  private readonly clk = new Schmitt()
  private note = 0
  private pulse = 0

  private nearest(semis: number, scale: number[]): number {
    let best = Math.round(semis)
    let bestD = Infinity
    const base = Math.floor(semis)
    for (let n = base - 6; n <= base + 7; n++) {
      if (!scale.includes(((n % 12) + 12) % 12)) continue
      const d = Math.abs(n - semis)
      if (d < bestD) {
        bestD = d
        best = n
      }
    }
    return best
  }

  tick(): void {
    const clocked = this.patched[this.iClk] === 1
    const edge = this.clk.rise(this.in[this.iClk])
    if (!clocked || edge) {
      const semis = this.in[this.iIn] * 12
      const scale = SCALES[Math.round(this.p[this.pScale])] ?? SCALES[0]
      const cand = this.nearest(semis, scale)
      // Hysteresis: only leave the current note once clearly closer to another.
      if (cand !== this.note && (Math.abs(semis - this.note) > Math.abs(semis - cand) + 0.08 || edge)) {
        this.note = cand
        this.pulse = Math.round(0.003 * this.fs)
      }
    }
    this.out[0] = (this.note + this.p[this.pTrans]) / 12
    this.out[1] = this.pulse > 0 ? 10 : 0
    if (this.pulse > 0) this.pulse--
    this.led[0] = this.pulse > 0 ? 1 : 0
  }
}

/** Two attenuverters. Unpatched inputs are normalled to a +5 V reference. */
export class AttenDsp extends Dsp {
  tick(): void {
    const i = this.in
    const p = this.p
    this.out[0] = rails((this.patched[0] ? i[0] : 5) * p[0])
    this.out[1] = rails((this.patched[1] ? i[1] : 5) * p[1])
  }
}
