import { PP_BEATS } from '../../../modules/specs/fx2'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { DelayLine } from '../delayLine'
import { fastTanh, TAU } from '../util'

const MAX_S = 4.2
/** The line's soft ceiling (repeats past 100% saturate instead of exploding). */
const sat = (x: number): number => 5 * fastTanh(x / 5)

/** PING-PONG: two lines. In PING-PONG the input (summed to mono) goes into
 *  the left line, which feeds the right, which feeds the left: each repeat
 *  on the other side. STEREO keeps each side to itself, MONO one line. The
 *  repeats are darkened by TONE every time round, saturate softly, and duck
 *  while the input is loud so they fill the gaps rather than the notes. */
export class PingPongDsp extends Dsp {
  private readonly I = { l: this.ii('l'), r: this.ii('r'), clk: this.ii('clk') }
  private readonly oL = this.oi('ol')
  private readonly oR = this.oi('or')
  private readonly P = { div: this.pi('div'), bpm: this.pi('bpm'), fb: this.pi('fb'), tone: this.pi('tone'), duck: this.pi('duck'), mix: this.pi('mix'), mode: this.pi('mode') }
  private readonly a: DelayLine
  private readonly b: DelayLine
  private readonly clk = new Schmitt()
  private since = 0
  private period = 0
  private time = -1
  private lpA = 0
  private lpB = 0
  private env = 0
  private readonly glide: number

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.a = new DelayLine(Math.ceil(MAX_S * this.fs))
    this.b = new DelayLine(Math.ceil(MAX_S * this.fs))
    this.glide = 1 - Math.exp(-1 / (0.08 * this.fs))
  }

  tick(): void {
    const p = this.p
    const i = this.in
    this.since++
    if (this.patched[this.I.clk] && this.clk.rise(i[this.I.clk])) {
      if (this.since > 16) this.period = this.since
      this.since = 0
    }
    // a CLK's 16ths set the tempo; otherwise TEMPO
    const quarter = this.patched[this.I.clk] && this.period > 0 ? (this.period * 4) / this.fs : 60 / p[this.P.bpm]
    const target = Math.min(MAX_S - 0.01, quarter * PP_BEATS[Math.round(p[this.P.div])]) * this.fs
    this.time = this.time < 0 ? target : this.time + (target - this.time) * this.glide
    const l = i[this.I.l]
    const r = this.patched[this.I.r] ? i[this.I.r] : l
    const mode = Math.round(p[this.P.mode])
    const ya = this.a.tapHermite(this.time)
    const yb = this.b.tapHermite(this.time)
    const k = 1 - Math.exp((-TAU * p[this.P.tone]) / this.fs)
    this.lpA += (ya - this.lpA) * k
    this.lpB += (yb - this.lpB) * k
    const fb = p[this.P.fb]
    if (mode === 0) {
      this.a.write(sat((l + r) * 0.5 + this.lpB * fb))
      this.b.write(sat(this.lpA))
    } else if (mode === 1) {
      this.a.write(sat(l + this.lpA * fb))
      this.b.write(sat(r + this.lpB * fb))
    } else {
      this.a.write(sat((l + r) * 0.5 + this.lpA * fb))
      this.b.write(0)
    }
    // ducking: the wet follows the input's loudness down
    const lev = Math.abs(l) + Math.abs(r)
    this.env = lev > this.env ? this.env + (lev - this.env) * 0.01 : this.env * 0.9997
    const duck = 1 - p[this.P.duck] * Math.min(1, this.env / 4)
    const mix = p[this.P.mix]
    const wl = this.lpA * duck
    const wr = (mode === 2 ? this.lpA : this.lpB) * duck
    this.out[this.oL] = l * (1 - mix * 0.5) + wl * mix
    this.out[this.oR] = r * (1 - mix * 0.5) + wr * mix
  }
}

/** FLANGER: a delay of MANUAL ms swept by a triangle (DEPTH) and SWEEP CV,
 *  fed back (negative: hollow, positive: ringing), against the dry; the
 *  right side's sweep runs the other way for width. */
export class FlangerDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iCv = this.ii('cv')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly P = { rate: this.pi('rate'), depth: this.pi('depth'), manual: this.pi('manual'), fb: this.pi('fb'), mix: this.pi('mix') }
  private readonly line: DelayLine
  private ph = 0
  private lastL = 0
  private lastR = 0
  private readonly ms: number

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.ms = this.fs / 1000
    this.line = new DelayLine(Math.ceil(20 * this.ms))
    this.ph = this.rng.next()
  }

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    this.ph = (this.ph + p[this.P.rate] / this.fs) % 1
    const tri = this.ph < 0.5 ? this.ph * 4 - 1 : 3 - this.ph * 4
    const cv = this.patched[this.iCv] ? this.in[this.iCv] / 5 : 0
    const centre = p[this.P.manual] * Math.pow(2, cv)
    // the sweep is exponential in time, as the ear hears it
    const dl = Math.min(18, Math.max(0.05, centre * Math.pow(2, tri * 2 * p[this.P.depth]))) * this.ms
    const dr = Math.min(18, Math.max(0.05, centre * Math.pow(2, -tri * 2 * p[this.P.depth]))) * this.ms
    const fb = p[this.P.fb]
    this.line.write(5 * fastTanh((x + (this.lastL + this.lastR) * 0.5 * fb) / 5))
    this.lastL = this.line.tapHermite(dl)
    this.lastR = this.line.tapHermite(dr)
    const mix = p[this.P.mix]
    this.out[this.oL] = (x * (1 - mix) + this.lastL * mix) * (1 + mix * 0.4)
    this.out[this.oR] = (x * (1 - mix) + this.lastR * mix) * (1 + mix * 0.4)
  }
}

/** COMB: delay = one period of FREQ (V/OCT), fed back through a damping
 *  low-pass; negative feedback rings an octave lower and hollow (odd partials). */
export class CombDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iV = this.ii('voct')
  private readonly oOut = this.oi('out')
  private readonly P = { freq: this.pi('freq'), fb: this.pi('fb'), damp: this.pi('damp'), mix: this.pi('mix') }
  private readonly line: DelayLine
  private lp = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.line = new DelayLine(Math.ceil(this.fs / 15))
  }

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    const hz = Math.max(16, Math.min(this.fs / 4, p[this.P.freq] * Math.pow(2, this.patched[this.iV] ? this.in[this.iV] : 0)))
    const y = this.line.tapHermite(this.fs / hz)
    this.lp += (y - this.lp) * (1 - p[this.P.damp] * 0.9)
    this.line.write(5 * fastTanh((x + this.lp * p[this.P.fb]) / 5))
    const mix = p[this.P.mix]
    this.out[this.oOut] = x * (1 - mix) + y * mix * 1.5
  }
}
