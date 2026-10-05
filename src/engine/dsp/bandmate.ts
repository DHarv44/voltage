import type { ModuleSpec } from '../../modules/types'
import { BAND_ROWS, BAND_STYLES, BANDL } from '../../modules/specs/bandmate'
import { Dsp } from './base'
import { Schmitt } from './cores'

const ROWS = BAND_ROWS.length
const KICK = 0
const SNARE = 1
const HAT = 2
const OPEN = 3
const TOM = 4
const CRASH = 5
const TRIG_S = 0.005

/** The drummer. Composes a bar at a time (velocities per row and step, 0 = rest),
 *  then plays it with a little human timing. */
export class BandmateDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iEnergy = this.ii('energy')
  private readonly iListen = this.ii('listen')
  private readonly pStyle = this.pi('style')
  private readonly pTempo = this.pi('tempo')
  private readonly pEnergy = this.pi('energy')
  private readonly pPhrase = this.pi('phrase')
  private readonly pHuman = this.pi('human')
  private readonly pRun = this.pi('run')
  private readonly bar = new Float64Array(ROWS * 16)
  private readonly tomPitch = new Float64Array(16)
  private readonly clk = new Schmitt()
  private step = -1
  private barN = 0
  private ph = 1
  private filling = false
  private crashNext = false
  private readonly trig = new Int32Array(ROWS)
  /** Hits waiting for their humanised moment: [samples left, row, velocity]. */
  private readonly pending = new Float64Array(ROWS * 3).fill(-1)
  private acc = 0
  private tomCv = 0
  private loud = 0

  private energy(): number {
    const listen = Math.min(1, this.loud * 0.6) // you're playing: lay back
    return Math.min(1, Math.max(0, this.p[this.pEnergy] + this.in[this.iEnergy] / 10 - listen * 0.5))
  }

  /** Write the next bar: groove from the style map, then a fill if it's the end of a phrase. */
  private compose(): void {
    const style = BAND_STYLES[Math.round(this.p[this.pStyle])] ?? BAND_STYLES[0]
    const e = this.energy()
    const b = this.bar
    b.fill(0)
    for (let s = 0; s < 16; s++) {
      for (let r = 0; r < 4; r++) {
        const base = Number(style.rows[r][s]) / 9
        // energy adds the in-between notes a drummer adds when the band lifts
        const pr = base >= 0.99 ? 1 : Math.min(1, base * (0.6 + e) + (r === HAT ? e * 0.15 : 0))
        if (this.rng.next() < pr) b[r * 16 + s] = (s % 4 === 0 ? 0.9 : 0.7) + this.rng.next() * 0.1
      }
      const ghost = (Number(style.rows[4][s]) / 9) * e * 1.5
      if (!b[SNARE * 16 + s] && this.rng.next() < ghost) b[SNARE * 16 + s] = 0.25 + this.rng.next() * 0.1
      if (b[OPEN * 16 + s]) b[HAT * 16 + s] = 0 // open and closed hat share a pedal
    }
    if (this.crashNext) {
      b[CRASH * 16] = 1
      b[KICK * 16] = Math.max(b[KICK * 16], 0.95)
      this.crashNext = false
    }
    const phrase = Math.round(this.p[this.pPhrase])
    this.filling = (this.barN + 1) % phrase === 0
    if (this.filling) {
      const from = e > 0.6 ? 8 : 12
      for (let s = from; s < 16; s++) for (let r = 0; r < 4; r++) b[r * 16 + s] = 0
      const kind = Math.floor(this.rng.next() * 3)
      for (let s = from; s < 16; s++) {
        const rise = 0.4 + (0.6 * (s - from)) / (16 - from)
        if (kind === 0) b[SNARE * 16 + s] = rise // snare roll, building
        else if (kind === 1) {
          b[TOM * 16 + s] = rise // tom run down the kit
          this.tomPitch[s] = 1.2 - ((s - from) / (16 - from)) * 1.4
        } else if (s % 2 === 0) {
          b[KICK * 16 + s] = rise // unison hits
          b[SNARE * 16 + s] = rise
        }
      }
      this.crashNext = this.rng.next() < 0.85
    }
    this.barN++
    for (let i = 0; i < ROWS * 16; i++) this.led[BANDL.grid + i] = b[i]
  }

  private hit(r: number, v: number): void {
    this.trig[r] = Math.round(TRIG_S * this.fs)
    this.acc = v * 10
  }

  private advance(): void {
    this.step = (this.step + 1) % 16
    if (this.step === 0) this.compose()
    const human = this.p[this.pHuman]
    for (let r = 0; r < ROWS; r++) {
      const v = this.bar[r * 16 + this.step]
      if (!v) continue
      if (r === TOM) this.tomCv = this.tomPitch[this.step]
      // a human is a few milliseconds early or late, and never hits twice the same
      const late = Math.max(0, this.rng.gauss() * human * 0.006 + human * 0.004) * this.fs
      this.pending[r * 3] = late
      this.pending[r * 3 + 1] = r
      this.pending[r * 3 + 2] = Math.min(1, v * (1 + (this.rng.next() - 0.5) * human * 0.3))
    }
  }

  tick(): void {
    const p = this.p
    const a = Math.abs(this.in[this.iListen]) / 5
    this.loud += (a - this.loud) * (a > this.loud ? 0.01 : 0.00005)
    if (p[this.pRun] >= 0.5) {
      if (this.patched[this.iClk]) {
        if (this.clk.rise(this.in[this.iClk])) this.advance()
      } else {
        const style = BAND_STYLES[Math.round(p[this.pStyle])] ?? BAND_STYLES[0]
        const sixteenth = 60 / p[this.pTempo] / 4
        const len = sixteenth * (this.step % 2 === 0 ? 1 + style.swing : 1 - style.swing)
        this.ph += 1 / this.fs / len
        if (this.ph >= 1) {
          this.ph -= 1
          this.advance()
        }
      }
    } else {
      this.step = -1
      this.ph = 1
    }
    for (let r = 0; r < ROWS; r++) {
      const k = r * 3
      if (this.pending[k] >= 0 && --this.pending[k] < 0) this.hit(this.pending[k + 1], this.pending[k + 2])
    }
    const o = this.out
    for (let r = 0; r < ROWS; r++) {
      o[r] = this.trig[r] > 0 ? 10 : 0
      if (this.trig[r] > 0) this.trig[r]--
    }
    o[ROWS] = this.acc
    o[ROWS + 1] = this.tomCv
    o[ROWS + 2] = this.filling && this.step >= 8 ? 10 : 0
    this.led[BANDL.step] = this.step
    this.led[BANDL.fill] = this.filling ? 1 : 0
  }
}
