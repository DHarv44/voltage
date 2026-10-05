import type { ModuleSpec } from '../../modules/types'
import { Dsp } from './base'
import { Biquad, Changed } from './biquad'

const CTRL = 32

/** EQ knob → gain: fully down kills the band, noon is flat, full is +6 dB. */
const bandGain = (v: number) => (v <= 0.02 ? 0 : v <= 1 ? v * v : 1 + (v - 1) * 2)

class Channel {
  readonly lo1: Biquad
  readonly lo2: Biquad
  readonly hi1: Biquad
  readonly hi2: Biquad
  /** Mid band: its own band-pass (high-pass 250 → low-pass 2.5k), so killing
   *  the lows really removes them (a subtracted mid would leak them back). */
  readonly m1: Biquad
  readonly m2: Biquad
  readonly m3: Biquad
  readonly m4: Biquad
  readonly filt: Biquad
  readonly changed = new Changed()
  mode = 0
  peak = 0
  constructor(fs: number) {
    // 4th-order (Linkwitz-Riley) crossovers at 250 Hz and 2.5 kHz: the isolator's bands.
    this.lo1 = new Biquad(fs).lowpass(250)
    this.lo2 = new Biquad(fs).lowpass(250)
    this.hi1 = new Biquad(fs).highpass(2500)
    this.hi2 = new Biquad(fs).highpass(2500)
    this.m1 = new Biquad(fs).highpass(250)
    this.m2 = new Biquad(fs).highpass(250)
    this.m3 = new Biquad(fs).lowpass(2500)
    this.m4 = new Biquad(fs).lowpass(2500)
    this.filt = new Biquad(fs)
  }
  /** One-knob filter: left = low-pass closing, right = high-pass opening. */
  design(f: number): void {
    if (!this.changed.test(f)) return
    const a = Math.abs(f)
    this.mode = a < 0.03 ? 0 : f < 0 ? -1 : 1
    const q = 0.7 + a * a * 1.6
    if (this.mode < 0) this.filt.lowpass(20000 * Math.pow(200 / 20000, a), q)
    else if (this.mode > 0) this.filt.highpass(20 * Math.pow(8000 / 20, a), q)
  }
  run(x: number, hi: number, mid: number, lo: number): number {
    const l = this.lo2.run(this.lo1.run(x))
    const h = this.hi2.run(this.hi1.run(x))
    const m = this.m4.run(this.m3.run(this.m2.run(this.m1.run(x))))
    const y = l * bandGain(lo) + m * bandGain(mid) + h * bandGain(hi)
    return this.mode === 0 ? y : this.filt.run(y)
  }
}

/** Two-channel DJ mixer (see the spec). */
export class DjMixDsp extends Dsp {
  private readonly iA = this.ii('a')
  private readonly iB = this.ii('b')
  private readonly iX = this.ii('xcv')
  private readonly ch: Channel[]
  private readonly pi_: number[][]
  private readonly pX = this.pi('xfade')
  private readonly pCurve = this.pi('curve')
  private readonly pMaster = this.pi('master')
  private n = CTRL

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.ch = [new Channel(fs), new Channel(fs)]
    this.pi_ = ['a', 'b'].map((c) => ['trim', 'hi', 'mid', 'lo', 'filter', 'fader'].map((k) => this.pi(`${c}${k}`)))
  }

  tick(): void {
    const p = this.p
    if (++this.n >= CTRL) {
      this.n = 0
      this.ch[0].design(p[this.pi_[0][4]])
      this.ch[1].design(p[this.pi_[1][4]])
    }
    const x = Math.min(1, Math.max(0, p[this.pX] + this.in[this.iX] / 10))
    let ga: number
    let gb: number
    if (p[this.pCurve] >= 0.5) {
      // scratch curve: each side cuts in within the last 3 % of travel
      ga = x < 0.97 ? 1 : (1 - x) / 0.03
      gb = x > 0.03 ? 1 : x / 0.03
    } else {
      ga = Math.cos((x * Math.PI) / 2)
      gb = Math.sin((x * Math.PI) / 2)
    }
    let mix = 0
    for (let c = 0; c < 2; c++) {
      const k = this.pi_[c]
      const ch = this.ch[c]
      const v = this.in[c === 0 ? this.iA : this.iB] * p[k[0]]
      const y = ch.run(v, p[k[1]], p[k[2]], p[k[3]]) * p[k[5]] * p[k[5]]
      ch.peak = Math.max(Math.abs(y) / 5, ch.peak * 0.9997)
      this.led[c] = Math.min(1, ch.peak)
      mix += y * (c === 0 ? ga : gb)
    }
    const out = mix * p[this.pMaster]
    this.out[0] = out
    this.out[1] = out
  }
}
