import type { ModuleSpec } from '../../modules/types'
import { TANL, TANPURA_FIRST_SEMIS } from '../../modules/specs/tanpura'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { DelayLine } from './delayLine'
import { C4 } from './util'

/** When in the cycle each string is plucked (fractions of CYCLE). */
const CYCLE_AT = [0, 0.22, 0.44, 0.66]
const PLUCK_S = 0.004

/** One string: a waveguide loop (delay + damping) with the jawari bridge in it.
 *  The bridge is one-sided: displacement past it is pushed back, which folds
 *  energy into high partials — strongest while the note is loud, so the buzz
 *  blooms and slowly settles exactly like the real thing. */
class TString {
  readonly line: DelayLine
  private lp = 0
  private excite = 0
  private exciteLp = 0
  private seed: number
  constructor(maxSamples: number, seed: number) {
    this.line = new DelayLine(maxSamples)
    this.seed = seed | 1
  }
  pluck(fs: number): void {
    this.excite = Math.round(PLUCK_S * fs)
  }
  step(period: number, loss: number, jawari: number): number {
    let x = 0
    if (this.excite > 0) {
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
      this.exciteLp += (this.seed / 2147483648 - this.exciteLp) * 0.3 // soft fingertip
      x = this.exciteLp * 0.8
      this.excite--
    }
    let y = this.line.tapLin(period)
    const b = 0.25 - jawari * 0.22
    if (y > b) y = b + (y - b) * (1 - jawari * 0.85)
    this.lp += (y - this.lp) * 0.6
    this.line.write((this.lp + x) * loss)
    return y
  }
}

export class TanpuraDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iClk = this.ii('clk')
  private readonly pSa = this.pi('sa')
  private readonly pFirst = this.pi('first')
  private readonly pCycle = this.pi('cycle')
  private readonly pJawari = this.pi('jawari')
  private readonly pDecay = this.pi('decay')
  private readonly pLevel = this.pi('level')
  private readonly strings: TString[]
  private readonly detune: number[]
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private readonly iRst = this.ii('rst')
  private t = 0
  private next = 0
  private gate = 0
  private last = -1
  private flash = 0
  private n = 32
  private readonly period = new Float64Array(4).fill(100)
  private readonly loss = new Float64Array(4)

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.strings = CYCLE_AT.map((_, i) => new TString(Math.ceil(fs / 30), seed + i * 7919))
    // the two Sa strings are never exactly together: that slow beating is the shimmer
    this.detune = [0, -0.0008, 0.0011, 0].map((d) => d + this.rng.gauss() * 0.0004)
  }

  private pluck(i: number): void {
    this.strings[i].pluck(this.fs)
    this.gate = Math.round(0.01 * this.fs)
    this.last = i
    this.flash = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'pluck' && ev.down) this.pluck(Math.max(0, Math.min(3, Math.round(ev.x))))
  }

  tick(): void {
    const p = this.p
    // RST: the cycle starts over on its first string (clocked: the next CLK plucks it)
    if (this.rst.rise(this.in[this.iRst])) {
      this.next = 0
      if (!this.patched[this.iClk]) {
        this.t = 0
        this.pluck(0)
      }
    }
    // The cycle: free-running, or one pluck per CLK.
    if (this.patched[this.iClk]) {
      if (this.clk.rise(this.in[this.iClk])) {
        this.pluck(this.next)
        this.next = (this.next + 1) % 4
      }
    } else {
      const cyc = p[this.pCycle]
      const before = this.t
      this.t += 1 / this.fs / cyc
      if (this.t >= 1) this.t -= 1
      for (let i = 0; i < 4; i++) if ((before < CYCLE_AT[i] && this.t >= CYCLE_AT[i]) || (before > this.t && CYCLE_AT[i] === 0)) this.pluck(i)
    }

    // Tuning and loss at control rate (they only change when a knob or CV does).
    if (++this.n >= 32) {
      this.n = 0
      const sa = p[this.pSa] / 12 + this.in[this.iV]
      const first = TANPURA_FIRST_SEMIS[Math.round(p[this.pFirst])] ?? -5
      for (let i = 0; i < 4; i++) {
        const semi = i === 0 ? first : i === 3 ? -12 : 0
        const f = C4 * Math.pow(2, sa + semi / 12 + this.detune[i])
        this.period[i] = this.fs / f - 0.5
        this.loss[i] = Math.pow(10, -3 / (f * p[this.pDecay])) // T60 = SUSTAIN
      }
    }
    const jaw = p[this.pJawari]
    let y = 0
    for (let i = 0; i < 4; i++) y += this.strings[i].step(this.period[i], this.loss[i], jaw) * (i === 3 ? 1.2 : 1)
    this.out[0] = Math.tanh(y * 3.5) * 5 * p[this.pLevel]
    this.out[1] = this.gate > 0 ? 10 : 0
    if (this.gate > 0) this.gate--
    this.flash *= 0.99985
    this.led[TANL.string] = this.last
    this.led[TANL.flash] = this.flash
  }
}
