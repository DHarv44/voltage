import { dmLevel } from '../../modules/specs/drummapNodes'
import { DM_STEPS, DML } from '../../modules/specs/seq2'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'

const PULSE_S = 0.005

/** DRUM MAP (the map is in specs/drummapNodes): each 16th, each drum's level is the four nearest grooves
 *  blended by where X and Y sit between them; it plays if the level clears
 *  1 − FILL (CHAOS shakes the levels, freshly each bar). */
export class DrumMapDsp extends Dsp {
  private readonly I = { clk: this.ii('clk'), rst: this.ii('rst'), x: this.ii('xcv'), y: this.ii('ycv') }
  private readonly O = [this.oi('bd'), this.oi('sd'), this.oi('hh')]
  private readonly oAcc = this.oi('acc')
  private readonly P = { x: this.pi('x'), y: this.pi('y'), d: [this.pi('dbd'), this.pi('dsd'), this.pi('dhh')], chaos: this.pi('chaos'), tempo: this.pi('tempo'), run: this.pi('run') }
  private readonly clock: PocketClock
  private readonly pulse = new Int32Array(4)
  private readonly shake = new Float32Array(DM_STEPS * 3)
  private step = -1

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.clock = new PocketClock(DM_STEPS, this.fs)
  }

  tick(): void {
    const p = this.p
    const running = p[this.P.run] >= 0.5
    const stepped = this.clock.tick(running, this.patched[this.I.clk] === 1, this.in[this.I.clk], p[this.P.tempo], 0, this.in[this.I.rst])
    if (this.clock.restarted || !running) this.step = -1
    if (stepped) {
      this.step = (this.step + 1) % DM_STEPS
      if (this.step === 0) for (let i = 0; i < this.shake.length; i++) this.shake[i] = (this.rng.next() - 0.5) * p[this.P.chaos] * 0.8
      const x = Math.max(0, Math.min(1, p[this.P.x] + (this.patched[this.I.x] ? this.in[this.I.x] / 10 : 0)))
      const y = Math.max(0, Math.min(1, p[this.P.y] + (this.patched[this.I.y] ? this.in[this.I.y] / 10 : 0)))
      let accent = false
      for (let d = 0; d < 3; d++) {
        const lv = dmLevel(d, this.step, x, y) + this.shake[this.step * 3 + d]
        if (lv > 0.02 && lv > 1 - p[this.P.d[d]]) {
          this.pulse[d] = Math.round(PULSE_S * this.fs)
          if (lv > 0.85 && d < 2) accent = true
        }
      }
      if (accent) this.pulse[3] = Math.round(PULSE_S * this.fs)
    }
    for (let d = 0; d < 3; d++) {
      this.out[this.O[d]] = this.pulse[d] > 0 ? 10 : 0
      this.led[DML.bd + d] = this.pulse[d] > 0 ? 1 : this.led[DML.bd + d] * 0.999
      if (this.pulse[d] > 0) this.pulse[d]--
    }
    this.out[this.oAcc] = this.pulse[3] > 0 ? 10 : 0
    if (this.pulse[3] > 0) this.pulse[3]--
    this.led[DML.step] = this.step
  }
}
