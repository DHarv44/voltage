import type { ModuleSpec } from '../../modules/types'
import { AU_LANES, AU_MAX_BARS, AU_POINTS, AU_RES, AUL, auT } from '../../modules/specs/automation'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'

const STEPS_PER_BAR = 16
/** Re-sort the lanes' points this often (samples): you may be dragging them. */
const RESORT = 1024
/** A breath of smoothing so a jump between points doesn't click (s). */
const SMOOTH_S = 0.002

/** AUTOMATION: counts 16ths from RST (its own tempo, or CLK) through BARS;
 *  each lane is a line through its points, read at the exact position
 *  (between 16ths too), held flat before the first point and after the last. */
export class AutomationDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oCv0 = this.oi('cv0')
  private readonly pTempo = this.pi('tempo')
  private readonly pBars = this.pi('bars')
  private readonly pLoop = this.pi('loop')
  private readonly pRun = this.pi('run')
  private readonly pRng0 = this.pi('rng0')
  private readonly pT0 = this.pi(auT(0, 0))
  private readonly clock: PocketClock
  private pos = -1
  private since = 0
  private held = false
  private count = RESORT
  /** Each lane's points, sorted by time: indices into the lane's slots. */
  private readonly order = new Int16Array(AU_LANES * AU_POINTS)
  private readonly n = new Int32Array(AU_LANES)
  private readonly v = new Float64Array(AU_LANES)
  private readonly smoothK: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(STEPS_PER_BAR * AU_MAX_BARS, fs)
    this.smoothK = 1 - Math.exp(-1 / (SMOOTH_S * fs))
  }

  private t(l: number, i: number): number {
    return Math.round(this.p[this.pT0 + (l * AU_POINTS + i) * 2])
  }

  private val(l: number, i: number): number {
    return this.p[this.pT0 + (l * AU_POINTS + i) * 2 + 1] / AU_RES
  }

  /** Sort each lane's points by time (insertion sort, in place: no allocation). */
  private resort(): void {
    for (let l = 0; l < AU_LANES; l++) {
      const o = l * AU_POINTS
      let n = 0
      for (let i = 0; i < AU_POINTS; i++) {
        if (this.t(l, i) < 0) continue
        let j = n++
        while (j > 0 && this.t(l, this.order[o + j - 1]) > this.t(l, i)) {
          this.order[o + j] = this.order[o + j - 1]
          j--
        }
        this.order[o + j] = i
      }
      this.n[l] = n
    }
  }

  /** Lane l at song position x (16ths), 0..1 (−1: no points). */
  private at(l: number, x: number): number {
    const n = this.n[l]
    if (n === 0) return -1
    const o = l * AU_POINTS
    const first = this.order[o]
    if (x <= this.t(l, first)) return this.val(l, first)
    for (let k = 1; k < n; k++) {
      const b = this.order[o + k]
      const tb = this.t(l, b)
      if (x <= tb) {
        const a = this.order[o + k - 1]
        const ta = this.t(l, a)
        const f = tb > ta ? (x - ta) / (tb - ta) : 1
        return this.val(l, a) + (this.val(l, b) - this.val(l, a)) * f
      }
    }
    return this.val(l, this.order[o + n - 1])
  }

  tick(): void {
    const p = this.p
    if (++this.count >= RESORT) {
      this.count = 0
      this.resort()
    }
    const running = p[this.pRun] >= 0.5
    const c = this.clock
    const stepped = c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.pTempo], 0, this.in[this.iRst])
    if (c.restarted || !running) {
      this.pos = -1
      this.held = false
    }
    const len = Math.max(1, Math.min(AU_MAX_BARS, Math.round(p[this.pBars]))) * STEPS_PER_BAR
    if (stepped && !this.held) {
      this.since = 0
      if (this.pos + 1 >= len) {
        if (p[this.pLoop] >= 0.5) this.pos = 0
        else this.held = true
      } else this.pos++
    }
    this.since++
    const frac = this.held ? 0 : Math.min(1, this.since / Math.max(1, c.stepLen * this.fs))
    const x = Math.max(0, this.pos) + frac
    const k = this.smoothK
    for (let l = 0; l < AU_LANES; l++) {
      const a = this.at(l, x)
      if (a >= 0) this.v[l] += (a - this.v[l]) * k
      const bi = p[this.pRng0 + l] >= 0.5
      this.out[this.oCv0 + l] = bi ? this.v[l] * 10 - 5 : this.v[l] * 10
      this.led[AUL.value0 + l] = this.v[l]
    }
    this.led[AUL.pos] = this.pos
  }
}
