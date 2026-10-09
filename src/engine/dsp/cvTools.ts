import type { ModuleSpec } from '../../modules/types'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { TAU } from './util'

const N = 4
const PHASE = 0
const RATIO = 1

/** QUAD LFO: four phases from one RATE (+ 1 V/oct on the RATE input). PHASE
 *  mode reads one phase at four offsets (SPREAD = a quarter cycle apart at
 *  full); RATIO runs them at ×(1 + k·SPREAD); DRIFT lets each wander slowly
 *  off the RATE (SPREAD: how far). S&H picks a new value each cycle. */
export class QuadLfoDsp extends Dsp {
  private readonly iRate = this.ii('rate')
  private readonly iRst = this.ii('rst')
  private readonly pRate = this.pi('rate')
  private readonly pShape = this.pi('shape')
  private readonly pMode = this.pi('mode')
  private readonly pSpread = this.pi('spread')
  private readonly pDepth = this.pi('depth')
  private readonly rst = new Schmitt()
  private readonly ph = new Float64Array(N)
  private readonly last = new Float64Array(N)
  private readonly held = new Float64Array(N)
  private readonly drift = new Float64Array(N)

  tick(): void {
    const p = this.p
    if (this.rst.rise(this.in[this.iRst])) this.ph.fill(0)
    const rate = p[this.pRate] * Math.pow(2, this.in[this.iRate])
    const mode = Math.round(p[this.pMode])
    const spread = p[this.pSpread]
    const shape = Math.round(p[this.pShape])
    const depth = p[this.pDepth] * 5
    for (let k = 0; k < N; k++) {
      let ph: number
      if (mode === PHASE) {
        if (k === 0) this.ph[0] = (this.ph[0] + rate / this.fs) % 1
        ph = (this.ph[0] + k * 0.25 * spread) % 1
      } else {
        let r = rate
        if (mode === RATIO) r *= 1 + k * spread
        else {
          // each drifts round the RATE on its own slow random walk
          this.drift[k] += (-this.drift[k] * 0.05 + (this.rng.next() - 0.5) * 0.9) / this.fs
          r *= 1 + Math.max(-0.6, Math.min(0.6, this.drift[k] * 4)) * spread
        }
        this.ph[k] = (this.ph[k] + r / this.fs) % 1
        ph = this.ph[k]
      }
      if (ph < this.last[k]) this.held[k] = this.rng.next() * 2 - 1 // a new cycle
      this.last[k] = ph
      const v = shape === 0 ? Math.sin(TAU * ph) : shape === 1 ? 1 - 4 * Math.abs(ph - 0.5) : shape === 2 ? 2 * ph - 1 : shape === 3 ? (ph < 0.5 ? 1 : -1) : this.held[k]
      this.out[k] = v * depth
      this.led[k] = v
    }
  }
}

/** CHANCE: each rising gate tosses a coin; B with the odds of CHANCE (+ CV,
 *  10 V = certain), else A. GATE: that side follows the input gate. LATCH:
 *  that side stays high until the next toss. IN 2 is normalled to IN 1. */
export class ChanceDsp extends Dsp {
  private readonly iIn = [this.ii('in1'), this.ii('in2')]
  private readonly iCv = [this.ii('cv1'), this.ii('cv2')]
  private readonly pP = [this.pi('p1'), this.pi('p2')]
  private readonly pMode = this.pi('mode')
  private readonly trig = [new Schmitt(), new Schmitt()]
  private readonly side = new Int8Array(2)

  tick(): void {
    const latch = this.p[this.pMode] >= 0.5
    for (let c = 0; c < 2; c++) {
      const x = c === 1 && !this.patched[this.iIn[1]] ? this.in[this.iIn[0]] : this.in[this.iIn[c]]
      if (this.trig[c].rise(x)) {
        const odds = this.p[this.pP[c]] + this.in[this.iCv[c]] / 10
        this.side[c] = this.rng.next() < odds ? 1 : 0
      }
      const on = latch || this.trig[c].high
      const a = on && this.side[c] === 0 ? 10 : 0
      const b = on && this.side[c] === 1 ? 10 : 0
      this.out[c * 2] = a
      this.out[c * 2 + 1] = b
      this.led[c * 2] = a / 10
      this.led[c * 2 + 1] = b / 10
    }
  }
}

const UP = 0
const PINGPONG = 1

/** SWITCH: a position 0..STEPS−1 that each clock moves (up, ping-pong or at
 *  random), RST sends home, SELECT (if patched) sets directly. OUT = the
 *  selected IN; X goes out of the selected X→ only. */
export class SeqSwitchDsp extends Dsp {
  private readonly iIn = [this.ii('in1'), this.ii('in2'), this.ii('in3'), this.ii('in4')]
  private readonly iX = this.ii('x')
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iSel = this.ii('sel')
  private readonly oOut = this.oi('out')
  private readonly oX = [this.oi('x1'), this.oi('x2'), this.oi('x3'), this.oi('x4')]
  private readonly pSteps = this.pi('steps')
  private readonly pOrder = this.pi('order')
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  /** −1: before position 1 (the next clock plays it). */
  private pos = -1
  private dir = 1

  tick(): void {
    const steps = Math.max(2, Math.min(N, Math.round(this.p[this.pSteps])))
    if (this.rst.rise(this.in[this.iRst])) {
      this.pos = -1
      this.dir = 1
    }
    if (this.clk.rise(this.in[this.iClk])) {
      const order = Math.round(this.p[this.pOrder])
      if (order === UP) this.pos = (this.pos + 1) % steps
      else if (order === PINGPONG) {
        if (this.pos + this.dir >= steps || this.pos + this.dir < 0) this.dir = -this.dir
        this.pos += this.dir
      } else this.pos = Math.floor(this.rng.next() * steps)
    }
    if (this.patched[this.iSel]) this.pos = Math.max(0, Math.min(steps - 1, Math.floor((this.in[this.iSel] / 10) * steps)))
    if (this.pos >= steps) this.pos = 0
    const at = this.pos < 0 ? 0 : this.pos
    this.out[this.oOut] = this.in[this.iIn[at]]
    const x = this.in[this.iX]
    for (let k = 0; k < N; k++) {
      this.out[this.oX[k]] = k === at ? x : 0
      this.led[k] = k === at ? 1 : 0
    }
  }
}

const TRACK = 0
const SH = 1

/** T&H: TRACK follows the input while the gate is high; S&H samples on each
 *  rise; HOLD follows while it's low. IN 1 unpatched is a slow random wander
 *  (±5 V); IN 2 and GATE 2 are normalled to channel 1. */
export class TrackHoldDsp extends Dsp {
  private readonly iIn = [this.ii('in1'), this.ii('in2')]
  private readonly iG = [this.ii('g1'), this.ii('g2')]
  private readonly pMode = [this.pi('m1'), this.pi('m2')]
  private readonly gate = [new Schmitt(), new Schmitt()]
  private readonly held = new Float64Array(2)
  /** The wander: a random walk pulled back toward 0 V (about ±4 V over a few
   *  seconds), smoothed so it glides. */
  private walk = 0
  private wander = 0
  private readonly kick: number
  /** Not `smooth`: the base class has one. */
  private readonly ease: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.kick = 4 * Math.sqrt(1 / fs)
    this.ease = 1 - Math.exp(-1 / (0.05 * fs))
  }

  tick(): void {
    this.walk += this.rng.gauss() * this.kick - (this.walk * 0.4) / this.fs
    this.wander += (Math.max(-5, Math.min(5, this.walk)) - this.wander) * this.ease
    const in1 = this.patched[this.iIn[0]] ? this.in[this.iIn[0]] : this.wander
    for (let c = 0; c < 2; c++) {
      const x = c === 0 || !this.patched[this.iIn[1]] ? in1 : this.in[this.iIn[1]]
      const g = c === 1 && !this.patched[this.iG[1]] ? this.in[this.iG[0]] : this.in[this.iG[c]]
      const rose = this.gate[c].rise(g)
      const high = this.gate[c].high
      const mode = Math.round(this.p[this.pMode[c]])
      if (mode === TRACK ? high : mode === SH ? rose : !high) this.held[c] = x
      this.out[c] = this.held[c]
      this.led[c] = this.held[c] / 5
    }
  }
}
