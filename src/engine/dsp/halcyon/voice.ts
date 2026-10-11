import { EnvCore, LadderCore, OscCore } from '../cores'
import { C4 } from '../util'

/** What every voice shares this sample (set once per sample by HALCYON). */
export interface HcShared {
  /** Octaves added to every voice: the range and the LFO on the DCOs. */
  oct: number
  pw: number
  pwmEnv: number
  saw: number
  pulse: number
  sub: number
  noise: number
  white: number
  cutoff: number
  /** Octaves on the cutoff from the LFO and CUTOFF CV. */
  fmod: number
  fenv: number
  kbd: number
  k: number
  a: number
  d: number
  s: number
  r: number
  gateMode: boolean
}

/** One voice: a DCO (saw and pulse, with a sub square an octave down that
 *  flips each time the oscillator wraps), noise, its own low-pass and its
 *  own envelope (every voice the same shape), into its VCA. */
export class HcVoice {
  /** Volts (0 = C4), the gate (volts), and the MIDI note for the screen. */
  pitch = 0
  gate = 0
  note = -1
  env = 0
  private readonly osc = new OscCore()
  private readonly ladder = new LadderCore()
  private readonly eg: EnvCore
  private subQ = 1
  private amp = 0
  private readonly w: number
  private readonly fMax: number
  private readonly gk: number

  constructor(private readonly fs: number, tol: number) {
    this.eg = new EnvCore(fs, tol)
    this.w = (2 * Math.PI) / (2 * fs)
    this.fMax = fs * 0.45
    this.gk = 1 - Math.exp(-1 / (0.002 * fs))
  }

  step(s: HcShared): number {
    const e = (this.env = this.eg.step(this.gate, false, s.a, s.d, s.s, s.r))
    if (e === 0 && this.gate < 1 && this.amp < 1e-5) return 0
    const hz = C4 * Math.pow(2, this.pitch + s.oct)
    const before = this.osc.phase
    const pw = s.pwmEnv > 0 ? 0.5 - 0.45 * s.pwmEnv * e : s.pw
    this.osc.step(Math.min(hz / this.fs, 0.45), pw)
    if (this.osc.phase < before) this.subQ = -this.subQ
    const x = this.osc.saw * s.saw + this.osc.sqr * s.pulse + this.subQ * s.sub + s.white * s.noise
    let fc = s.cutoff * Math.pow(2, s.fenv * e * 6 + s.kbd * this.pitch + s.fmod)
    fc = fc < 10 ? 10 : fc > this.fMax ? this.fMax : fc
    const y = this.ladder.process(x * 0.32, 1 - Math.exp(-fc * this.w), s.k)
    this.amp += ((s.gateMode ? (this.gate > 1 ? 1 : 0) : e) - this.amp) * this.gk
    return y * this.amp
  }
}
