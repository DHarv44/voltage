import { Dsp } from './base'
import { Schmitt } from './cores'

const RATES = [16, 8, 4, 2, 1] // pulses per bar for x4, x2, x1, d2, bar

/** Master clock: one bar-long phase ramp; every output is a 50% gate derived
 *  from it, so all divisions stay phase-locked. Crystal-stable (no drift). */
export class ClockDsp extends Dsp {
  private iReset = this.ii('reset')
  private pBpm = this.pi('bpm')
  private pRun = this.pi('run')
  private readonly reset = new Schmitt()
  private phase = 0
  private rstPulse = 0
  private wasRunning = false

  tick(): void {
    const running = this.p[this.pRun] >= 0.5
    if (this.reset.rise(this.in[this.iReset]) || (running && !this.wasRunning)) {
      this.phase = 0
      this.rstPulse = Math.round(0.003 * this.fs)
    }
    this.wasRunning = running
    const o = this.out
    for (let k = 0; k < RATES.length; k++) {
      const x = this.phase * RATES[k]
      o[k] = running && x - Math.floor(x) < 0.5 ? 10 : 0
    }
    o[5] = this.rstPulse > 0 ? 10 : 0
    if (this.rstPulse > 0) this.rstPulse--
    this.led[0] = o[2] / 10
    if (running) {
      this.phase += this.p[this.pBpm] / 60 / 4 / this.fs
      if (this.phase >= 1) this.phase -= 1
    }
  }
}

const DIVS = [2, 3, 4, 5, 6, 8]

/** Counter-based divider: each output toggles on input edges (≈50% duty). */
export class DividerDsp extends Dsp {
  private iClk = this.ii('clk')
  private iReset = this.ii('reset')
  private readonly clk = new Schmitt()
  private readonly reset = new Schmitt()
  private count = 0

  tick(): void {
    if (this.reset.rise(this.in[this.iReset])) this.count = 0
    if (this.clk.rise(this.in[this.iClk])) this.count++
    // Each output goes high on the FIRST clock of its group (low until the
    // first clock arrives), so ÷4 of a 16th clock lands on the beat.
    const c = this.count - 1
    for (let k = 0; k < DIVS.length; k++) this.out[k] = c >= 0 && c % DIVS[k] < DIVS[k] / 2 ? 10 : 0
  }
}

const STEPS = 8

/** 8-step sequencer. Advances on clock edges; the gate follows the clock's
 *  width so legato vs staccato comes from the clock source, as on the classics. */
export class Seq8Dsp extends Dsp {
  private iClk = this.ii('clk')
  private iReset = this.ii('reset')
  private pLen = this.pi('len')
  private pQuant = this.pi('quant')
  private pStep = Array.from({ length: STEPS }, (_, i) => this.pi(`s${i + 1}`))
  private pGate = Array.from({ length: STEPS }, (_, i) => this.pi(`g${i + 1}`))
  private readonly clk = new Schmitt()
  private readonly reset = new Schmitt()
  /** −1 = before the first step, so the first clock lands on step 1. */
  private step = -1
  private trig = 0

  tick(): void {
    const p = this.p
    if (this.reset.rise(this.in[this.iReset])) this.step = -1
    if (this.clk.rise(this.in[this.iClk])) {
      const len = Math.max(1, Math.round(p[this.pLen]))
      this.step = (this.step + 1) % len
      if (p[this.pGate[this.step]] >= 0.5) this.trig = Math.round(0.003 * this.fs)
    }
    const s = Math.max(0, this.step)
    const v = p[this.pStep[s]]
    const o = this.out
    o[0] = p[this.pQuant] >= 0.5 ? Math.round(v * 12) / 12 : v
    o[1] = this.clk.high && this.step >= 0 && p[this.pGate[s]] >= 0.5 ? 10 : 0
    o[2] = this.trig > 0 ? 10 : 0
    if (this.trig > 0) this.trig--
    for (let k = 0; k < STEPS; k++) this.led[k] = k === this.step ? 1 : 0
  }
}
