import { Schmitt } from './cores'
import { Dsp } from './base'
import { polyBlep, TAU } from './util'

/** A state-variable band-pass whose centre can move every sample (TPT form;
 *  the coefficient is redone every 16 samples). */
class Sweep {
  private s1 = 0
  private s2 = 0
  private g = 0.1
  private k = 1
  private n = 0
  constructor(private readonly fs: number) {}
  set(f: number, q: number): void {
    if (this.n++ % 16 !== 0) return
    this.g = Math.tan((Math.PI * Math.min(f, this.fs * 0.45)) / this.fs)
    this.k = 1 / q
  }
  run(x: number): number {
    const g = this.g
    const hp = (x - (this.k + g) * this.s1 - this.s2) / (1 + g * (this.k + g))
    const bp = g * hp + this.s1
    this.s1 = g * hp + bp
    const lp = g * bp + this.s2
    this.s2 = g * bp + lp
    return bp
  }
}

const TRIG_S = 0.004

/** RISER: see the spec. Progress u (0 … 1) comes from RAMP (when patched) or
 *  the time since GATE rose over LENGTH; everything rises with it. When the
 *  rise ends (RAMP back to 0, or GATE falls) having got past a third of the
 *  way, it lands: impact, downlifter and HIT. */
export class RiserDsp extends Dsp {
  private readonly iGate = this.ii('gate')
  private readonly iRamp = this.ii('ramp')
  private readonly iClk = this.ii('clk')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly oSweep = this.oi('sweep')
  private readonly oRoll = this.oi('rollo')
  private readonly oHit = this.oi('hit')
  private readonly P = {
    len: this.pi('len'),
    noise: this.pi('noise'),
    tone: this.pi('tone'),
    bright: this.pi('bright'),
    impact: this.pi('impact'),
    down: this.pi('down'),
    level: this.pi('level'),
    roll: this.pi('roll'),
  }
  private readonly gate = new Schmitt()
  private readonly clk = new Schmitt()
  private readonly bpL: Sweep
  private readonly bpR: Sweep
  private readonly fall: Sweep
  private active = false
  private u = 0
  private elapsed = 0
  private sweepOut = 0
  // the tone: two detuned saws, rising
  private ph1 = 0
  private ph2 = 0.37
  private toneLp = 0
  // the roll: clock edges counted, or time
  private clks = 0
  private sinceRoll = 0
  private sinceClk = 0
  private clkGap = 0.125
  private half = false
  private roll = 0
  // the landing
  private boom = 0
  private boomPh = 0
  private boomF = 60
  private burst = 0
  private burstLp = 0
  private dn = 0
  private dnF = 6000
  private hit = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.bpL = new Sweep(this.fs)
    this.bpR = new Sweep(this.fs)
    this.fall = new Sweep(this.fs)
  }

  private noise(): number {
    return this.rng.next() * 2 - 1
  }

  private land(): void {
    const p = this.p
    this.boom = p[this.P.impact]
    this.boomF = 62
    this.boomPh = 0
    this.burst = p[this.P.impact]
    this.dn = p[this.P.down]
    this.dnF = 3000 + 5000 * p[this.P.bright]
    this.hit = Math.round(TRIG_S * this.fs)
  }

  private fireRoll(): void {
    this.roll = Math.round(TRIG_S * this.fs)
    this.sinceRoll = 0
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const dt = 1 / fs
    const ramped = this.patched[this.iRamp] === 1
    const gateHigh = this.gate.rise(this.in[this.iGate]) || this.gate.high
    const now = ramped ? this.in[this.iRamp] > 0.05 : gateHigh
    if (now && !this.active) {
      this.elapsed = 0
      this.clks = 0
    }
    if (!now && this.active && this.u > 0.33) this.land()
    this.active = now
    if (now) {
      this.elapsed += dt
      this.u = ramped ? Math.min(1, Math.max(0, this.in[this.iRamp] / 10)) : Math.min(1, this.elapsed / Math.max(0.1, p[this.P.len]))
    } else this.u = 0
    const u = this.u
    // the roll: every 4, 2, 1, then ½ a clock as it rises (or by time, unclocked)
    const clocked = this.patched[this.iClk] === 1
    this.sinceClk += dt
    this.sinceRoll += dt
    const every = u < 0.25 ? 4 : u < 0.5 ? 2 : 1
    if (clocked && this.clk.rise(this.in[this.iClk])) {
      this.clkGap = Math.min(1, this.sinceClk)
      this.sinceClk = 0
      this.half = false
      if (now && p[this.P.roll] >= 0.5 && this.clks++ % every === 0) this.fireRoll()
    } else if (clocked && now && u >= 0.75 && p[this.P.roll] >= 0.5 && !this.half && this.sinceClk >= this.clkGap / 2) {
      this.half = true
      this.fireRoll()
    } else if (!clocked && now && p[this.P.roll] >= 0.5 && this.sinceRoll >= 0.5 / 2 ** Math.floor(u * 4)) this.fireRoll()
    // the rise: noise up a tightening band, a tone climbing, both widening
    let l = 0
    let r = 0
    if (u > 0) {
      const b = p[this.P.bright]
      const f = 250 * Math.pow(2, u * (4 + 2.5 * b))
      const q = 0.8 + 3 * u
      this.bpL.set(f, q)
      this.bpR.set(f * 1.04, q)
      const amp = Math.pow(u, 1.5) * p[this.P.noise] * 3
      const width = 0.2 + 0.8 * u
      const nl = this.bpL.run(this.noise())
      const nr = this.bpR.run(this.noise())
      l += (nl * (1 + width) + nr * (1 - width)) * 0.5 * amp
      r += (nr * (1 + width) + nl * (1 - width)) * 0.5 * amp
      const tf = 110 * Math.pow(2, u * 2) * (1 + b)
      const d1 = tf / fs
      const d2 = (tf * 1.012) / fs
      this.ph1 = (this.ph1 + d1) % 1
      this.ph2 = (this.ph2 + d2) % 1
      const s1 = 2 * this.ph1 - 1 - polyBlep(this.ph1, d1)
      const s2 = 2 * this.ph2 - 1 - polyBlep(this.ph2, d2)
      this.toneLp += ((s1 + s2) * 0.5 - this.toneLp) * (0.05 + 0.4 * u * b)
      const ta = u * u * p[this.P.tone] * 1.6
      l += this.toneLp * ta * (1 - 0.3 * width)
      r += this.toneLp * ta * (1 - 0.3 * width) * 0.97
    }
    // the landing: a sub boom that sinks, a burst, the downlifter falling away
    if (this.boom > 1e-4) {
      this.boomF = 34 + (this.boomF - 34) * 0.9997
      this.boomPh = (this.boomPh + this.boomF / fs) % 1
      const y = Math.sin(TAU * this.boomPh) * this.boom * 2.2
      l += y
      r += y
      this.boom *= 0.99995
      if (this.boom < 0.002) this.boom = 0
    }
    if (this.burst > 1e-4) {
      this.burstLp += (this.noise() - this.burstLp) * 0.35
      l += this.burstLp * this.burst * 1.5
      r += this.burstLp * this.burst * 1.5
      this.burst *= 0.9996
    }
    if (this.dn > 1e-4) {
      this.dnF = 120 + (this.dnF - 120) * 0.99995
      this.fall.set(this.dnF, 2)
      const y = this.fall.run(this.noise()) * this.dn * 2.5
      l += y
      r -= y * 0.6
      this.dn *= 0.99997
    }
    // SWEEP follows the rise and drops fast after it
    const target = 10 * Math.pow(u, 1.5)
    this.sweepOut += (target - this.sweepOut) * (target > this.sweepOut ? 0.01 : 0.001)
    const lvl = p[this.P.level] * 2
    this.out[this.oL] = l * lvl
    this.out[this.oR] = r * lvl
    this.out[this.oSweep] = this.sweepOut
    this.out[this.oRoll] = this.roll > 0 ? 10 : 0
    this.out[this.oHit] = this.hit > 0 ? 10 : 0
    if (this.roll > 0) this.roll--
    if (this.hit > 0) this.hit--
    this.led[0] = u
  }
}
