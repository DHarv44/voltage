import { Dsp } from './base'
import type { UiEvent } from '../protocol'
import { LadderCore, OscCore, Schmitt } from './cores'
import { TempoClock } from './stepSeq'
import { Drift } from './drift'
import { UT_ASSIGN, UT_RANGE_DIV, UT_RANGE_OCT, UT_RHYTHMS, UT_STEPS, UTL } from '../../modules/specs/undertone'
import { AdEnv, SubOsc, quantize } from './undertoneParts'
import { TAU, rails } from './util'

/** One oscillator with its two subharmonics. */
class Voice {
  readonly osc = new OscCore()
  readonly sub1 = new SubOsc()
  readonly sub2 = new SubOsc()
  /** Glided sequencer offset (octaves). */
  off = 0
  w = 0
  s1 = 0
  s2 = 0

  step(dt: number, n1: number, n2: number, sqr: boolean): void {
    const t = this.osc.phase
    this.s1 = this.sub1.out(t, dt, n1, sqr)
    this.s2 = this.sub2.out(t, dt, n2, sqr)
    this.osc.step(dt, 0.5)
    this.w = sqr ? this.osc.sqr : this.osc.saw
    if (this.osc.phase < t) {
      this.sub1.wrap(n1)
      this.sub2.wrap(n2)
    }
  }
}

/** UNDERTONE: the Subharmonicon-style system. A base clock (TEMPO 16ths, or
 *  CLOCK in) drives four rhythm dividers; each sequencer advances when the
 *  rhythms routed to it fire (OR: any of them, XOR: an odd number), and
 *  every advance strikes both AD envelopes. A sequencer moves whatever its
 *  ASSIGN row lights: its VCO's pitch and/or its subs' divisions. */
export class UndertoneDsp extends Dsp {
  private I = {
    vco1: this.ii('vco1'), sub11: this.ii('sub11'), sub12: this.ii('sub12'), vco2: this.ii('vco2'),
    sub21: this.ii('sub21'), sub22: this.ii('sub22'), cutoff: this.ii('cutoff'), vca: this.ii('vca'),
    play: this.ii('play'), reset: this.ii('reset'), clock: this.ii('clock'),
  }
  private iRhy = Array.from({ length: UT_RHYTHMS }, (_, i) => this.ii(`rhy${i + 1}`))
  private O = {
    vca: this.oi('vca'), vco1: this.oi('vco1'), sub1: this.oi('sub1'), vco2: this.oi('vco2'), sub2: this.oi('sub2'),
    vcfeg: this.oi('vcfeg'), vcaeg: this.oi('vcaeg'), seq1: this.oi('seq1'), seq2: this.oi('seq2'), clk: this.oi('clk'),
  }
  private P = {
    vco1: this.pi('vco1'), s11: this.pi('s11'), s12: this.pi('s12'), l1: this.pi('l1'), l11: this.pi('l11'), l12: this.pi('l12'),
    vco2: this.pi('vco2'), s21: this.pi('s21'), s22: this.pi('s22'), l2: this.pi('l2'), l21: this.pi('l21'), l22: this.pi('l22'),
    wave1: this.pi('wave1'), wave2: this.pi('wave2'), cutoff: this.pi('cutoff'), res: this.pi('res'), vcfeg: this.pi('vcfeg'),
    vcfa: this.pi('vcfa'), vcfd: this.pi('vcfd'), vcaa: this.pi('vcaa'), vcad: this.pi('vcad'), vcamode: this.pi('vcamode'),
    vol: this.pi('vol'), quant: this.pi('quant'), range: this.pi('range'), glide: this.pi('glide'),
    as1: this.pi('as1'), as2: this.pi('as2'), rt1: this.pi('rt1'), rt2: this.pi('rt2'), logic: this.pi('logic'),
    tempo: this.pi('tempo'), run: this.pi('run'),
  }
  private pA = Array.from({ length: UT_STEPS }, (_, i) => this.pi(`a${i}`))
  private pB = Array.from({ length: UT_STEPS }, (_, i) => this.pi(`b${i}`))
  private pR = Array.from({ length: UT_RHYTHMS }, (_, i) => this.pi(`r${i + 1}`))

  private readonly v1 = new Voice()
  private readonly v2 = new Voice()
  private readonly ladder = new LadderCore()
  private readonly vcfEnv = new AdEnv()
  private readonly vcaEnv = new AdEnv()
  private readonly clock = new TempoClock(this.fs)
  private readonly clkIn = new Schmitt()
  private readonly rstIn = new Schmitt()
  private readonly rhyIn = Array.from({ length: UT_RHYTHMS }, () => new Schmitt())
  private readonly fired = new Uint8Array(UT_RHYTHMS)
  private readonly drift1 = new Drift(this.rng, this.fs)
  private readonly drift2 = new Drift(this.rng, this.fs)
  private readonly tol1 = this.tol(0.01)
  private readonly tol2 = this.tol(0.01)
  private readonly ctol = this.tol(0.03)
  private readonly w = TAU / (2 * this.fs)
  private readonly fMax = this.fs * 0.45
  private readonly R = 1 - (TAU * 5) / this.fs
  private readonly ledDecay = Math.exp(-1 / (0.1 * this.fs))
  private hx = 0
  private hy = 0
  private tickN = 0
  private step1 = UT_STEPS - 1
  private step2 = UT_STEPS - 1
  private wasRunning = false
  private pendReset = false

  onUi(ev: UiEvent): void {
    if (ev.kind === 'button' && ev.name === 'reset' && ev.down) this.pendReset = true
  }

  private reset(): void {
    this.clock.reset()
    this.tickN = 0
    this.step1 = UT_STEPS - 1
    this.step2 = UT_STEPS - 1
  }

  /** Does a sequencer with this rhythm mask advance on this sample? */
  private advances(mask: number, xor: boolean): boolean {
    let n = 0
    for (let r = 0; r < UT_RHYTHMS; r++) if ((mask >> r) & 1 && this.fired[r]) n++
    return xor ? (n & 1) === 1 : n > 0
  }

  tick(): void {
    const { I, O, P } = this
    const i = this.in
    const p = this.p
    const pt = this.patched

    const running = pt[I.play] ? i[I.play] > 1.2 : p[P.run] >= 0.5
    if ((running && !this.wasRunning) || this.rstIn.rise(i[I.reset]) || this.pendReset) {
      this.reset()
      this.pendReset = false
    }
    this.wasRunning = running

    // Base clock → rhythm dividers (a patched RHY input replaces its divider).
    const clkEdge = this.clkIn.rise(i[I.clock])
    const base = running && (pt[I.clock] ? clkEdge : this.clock.tick(p[P.tempo]))
    for (let r = 0; r < UT_RHYTHMS; r++) {
      const edge = this.rhyIn[r].rise(i[this.iRhy[r]])
      this.fired[r] = pt[this.iRhy[r]] ? (running && edge ? 1 : 0) : base && this.tickN % Math.round(p[this.pR[r]]) === 0 ? 1 : 0
      if (this.fired[r]) this.led[UTL.rhythm + r] = 1
    }
    if (base) this.tickN++
    const xor = p[P.logic] >= 0.5
    const adv1 = this.advances(Math.round(p[P.rt1]), xor)
    const adv2 = this.advances(Math.round(p[P.rt2]), xor)
    if (adv1) this.step1 = (this.step1 + 1) % UT_STEPS
    if (adv2) this.step2 = (this.step2 + 1) % UT_STEPS
    if (adv1 || adv2) {
      this.vcfEnv.strike()
      this.vcaEnv.strike()
    }

    // Sequencer values: pitch (quantized, octaves) and division offsets.
    const range = Math.round(p[P.range])
    const q = Math.round(p[P.quant])
    const k1 = p[this.pA[this.step1]]
    const k2 = p[this.pB[this.step2]]
    const pitch1 = quantize(k1 * UT_RANGE_OCT[range], q)
    const pitch2 = quantize(k2 * UT_RANGE_OCT[range], q)
    const as1 = Math.round(p[P.as1])
    const as2 = Math.round(p[P.as2])
    const d1 = Math.round(k1 * UT_RANGE_DIV[range])
    const d2 = Math.round(k2 * UT_RANGE_DIV[range])

    const g = p[P.glide] > 0.001 ? 1 - Math.exp(-3 / (p[P.glide] * this.fs)) : 1
    this.v1.off += ((as1 & UT_ASSIGN.osc ? pitch1 : 0) - this.v1.off) * g
    this.v2.off += ((as2 & UT_ASSIGN.osc ? pitch2 : 0) - this.v2.off) * g

    const n11 = divisor(p[P.s11], as1 & UT_ASSIGN.sub1 ? d1 : 0, i[I.sub11])
    const n12 = divisor(p[P.s12], as1 & UT_ASSIGN.sub2 ? d1 : 0, i[I.sub12])
    const n21 = divisor(p[P.s21], as2 & UT_ASSIGN.sub1 ? d2 : 0, i[I.sub21])
    const n22 = divisor(p[P.s22], as2 & UT_ASSIGN.sub2 ? d2 : 0, i[I.sub22])
    const f1 = p[P.vco1] * this.tol1 * this.ctol * Math.pow(2, this.v1.off + i[I.vco1] + this.drift1.next(this.age))
    const f2 = p[P.vco2] * this.tol2 * this.ctol * Math.pow(2, this.v2.off + i[I.vco2] + this.drift2.next(this.age))
    this.v1.step(Math.min(f1 / this.fs, 0.45), n11, n12, p[P.wave1] >= 0.5)
    this.v2.step(Math.min(f2 / this.fs, 0.45), n21, n22, p[P.wave2] >= 0.5)
    const { v1, v2 } = this
    const mix =
      p[P.l1] * v1.w + p[P.l11] * v1.s1 + p[P.l12] * v1.s2 + p[P.l2] * v2.w + p[P.l21] * v2.s1 + p[P.l22] * v2.s2

    const fe = this.vcfEnv.step(p[P.vcfa], p[P.vcfd], this.fs)
    const ae = this.vcaEnv.step(p[P.vcaa], p[P.vcad], this.fs)
    let fc = p[P.cutoff] * this.ctol * Math.pow(2, p[P.vcfeg] * fe * 5 + i[I.cutoff])
    fc = fc < 5 ? 5 : fc > this.fMax ? this.fMax : fc
    const k = 4 * p[P.res]
    const vcf = this.ladder.process(mix * 0.6 * (1 + 0.3 * k), 1 - Math.exp(-fc * this.w), k)
    const amp = pt[I.vca] ? Math.max(0, Math.min(1.2, i[I.vca] / 10)) : p[P.vcamode] >= 0.5 ? 1 : ae
    const v = vcf * 5 * amp
    this.hy = v - this.hx + this.R * this.hy
    this.hx = v

    const o = this.out
    o[O.vca] = rails(this.hy * p[P.vol] * 3)
    o[O.vco1] = v1.w * 5
    o[O.sub1] = (v1.s1 + v1.s2) * 2.5
    o[O.vco2] = v2.w * 5
    o[O.sub2] = (v2.s1 + v2.s2) * 2.5
    o[O.vcfeg] = fe * 8
    o[O.vcaeg] = ae * 8
    o[O.seq1] = pitch1
    o[O.seq2] = pitch2
    o[O.clk] = running && (pt[I.clock] ? i[I.clock] > 1.2 : this.clock.high) ? 10 : 0

    const led = this.led
    for (let s = 0; s < UT_STEPS; s++) {
      led[UTL.seq1 + s] = running && s === this.step1 ? 1 : 0
      led[UTL.seq2 + s] = running && s === this.step2 ? 1 : 0
    }
    for (let r = 0; r < UT_RHYTHMS; r++) led[UTL.rhythm + r] *= this.ledDecay
    led[UTL.tempo] = running && this.clock.high ? 1 : 0
    led[UTL.none] = -1
  }
}

/** A sub's divisor: the knob, the sequencer's offset and CV (1 per volt), 1..16. */
function divisor(knob: number, seq: number, cv: number): number {
  const n = Math.round(knob) + seq + Math.round(cv)
  return n < 1 ? 1 : n > 16 ? 16 : n
}
