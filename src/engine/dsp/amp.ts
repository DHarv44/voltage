import type { ModuleSpec } from '../../modules/types'
import { Dsp } from './base'
import { Biquad, Changed } from './biquad'
import { PEDAL_IN } from './pedals/base'

const CTRL = 32

/** 12AX7 triode stage: grid conduction clips the top softly, cutoff the bottom
 *  harder, around a bias point — the even-harmonic asymmetry of a valve. */
function triode(x: number): number {
  const v = x + 0.25
  const y = v > 0 ? Math.tanh(v) : Math.tanh(v * 1.6) / 1.6
  return y - 0.2449 // tanh(0.25): no DC at rest
}

/** Valve amp + cab. See the spec for the signal path. Filters are re-designed
 *  at control rate only when a knob moved. */
export class AmpDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iGain = this.ii('gcv')
  private readonly pGain = this.pi('gain')
  private readonly pBass = this.pi('bass')
  private readonly pMid = this.pi('mid')
  private readonly pTreble = this.pi('treble')
  private readonly pPres = this.pi('presence')
  private readonly pMaster = this.pi('master')
  private readonly pSag = this.pi('sag')
  private readonly pMic = this.pi('mic')
  private readonly pCab = this.pi('cab')
  private readonly couple1: Biquad
  private readonly couple2: Biquad
  private readonly miller: Biquad
  private readonly bass: Biquad
  private readonly mid: Biquad
  private readonly treble: Biquad
  private readonly presence: Biquad
  private readonly cabHp: Biquad
  private readonly cabRes: Biquad
  private readonly cabMid: Biquad
  private readonly cabLp1: Biquad
  private readonly cabLp2: Biquad
  private readonly toneChanged = new Changed()
  private readonly cabChanged = new Changed()
  private n = 0
  private prev = 0
  private sagEnv = 0
  private readonly sagK: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    const b = () => new Biquad(fs)
    // the preamp runs 2× oversampled, so its coupling caps are designed at 2·fs
    this.couple1 = new Biquad(fs * 2).highpass(80 * this.tol(0.1), 0.6)
    this.couple2 = new Biquad(fs * 2).highpass(40 * this.tol(0.1), 0.6)
    this.miller = b().lowpass(9000 * this.tol(0.05))
    this.bass = b()
    this.mid = b()
    this.treble = b()
    this.presence = b()
    this.cabHp = b()
    this.cabRes = b()
    this.cabMid = b()
    this.cabLp1 = b()
    this.cabLp2 = b()
    this.sagK = 1 - Math.exp(-1 / (0.08 * fs))
  }

  private design(): void {
    const p = this.p
    if (this.toneChanged.test(p[this.pBass], p[this.pMid], p[this.pTreble], p[this.pPres])) {
      this.bass.lowShelf(120, (p[this.pBass] - 0.5) * 24)
      this.mid.peak(700, 0.7, (p[this.pMid] - 0.65) * 20)
      this.treble.highShelf(2800, (p[this.pTreble] - 0.5) * 24)
      this.presence.highShelf(4000, p[this.pPres] * 8)
    }
    const cab = Math.round(p[this.pCab])
    if (this.cabChanged.test(cab, p[this.pMic])) {
      const mic = p[this.pMic]
      const big = cab === 2
      this.cabHp.highpass(big ? 65 : 85, 0.9)
      this.cabRes.peak(big ? 95 : 115, 1.4, big ? 5 : 3.5)
      this.cabMid.peak(2400, 1.2, 4 - mic * 8)
      this.cabLp1.lowpass((big ? 5200 : 6200) * (1 - mic * 0.45), 0.8)
      this.cabLp2.lowpass((big ? 6000 : 7000) * (1 - mic * 0.4), 0.6)
    }
  }

  private pre(x: number): number {
    const p = this.p
    const gain = Math.min(1, Math.max(0, p[this.pGain] + this.in[this.iGain] / 10))
    // progressive taper: clean low down, breaking up past noon
    const a = triode(this.couple1.run(x) * (0.25 + gain * gain * 45))
    return triode(this.couple2.run(a) * (1 + gain * 6) * 0.8)
  }

  tick(): void {
    if (++this.n >= CTRL) {
      this.n = 0
      this.design()
    }
    const p = this.p
    const x = this.in[this.iIn] * PEDAL_IN
    // Preamp, 2× oversampled (midpoint + sample).
    const pre = this.miller.run((this.pre((x + this.prev) * 0.5) + this.pre(x)) * 0.5)
    this.prev = x
    const toned = this.treble.run(this.mid.run(this.bass.run(pre)))

    // Push-pull power stage on a supply that droops with the load.
    const drive = toned * (0.5 + p[this.pMaster] * 4)
    const rail = 1 - p[this.pSag] * 0.45 * this.sagEnv
    const power = rail * Math.tanh(drive / rail)
    this.sagEnv += (Math.abs(power) - this.sagEnv) * this.sagK
    const amp = this.presence.run(power)

    const cab = Math.round(p[this.pCab])
    let speaker = amp
    if (cab > 0) speaker = this.cabLp2.run(this.cabLp1.run(this.cabMid.run(this.cabRes.run(this.cabHp.run(amp)))))
    this.out[0] = speaker * 4
    this.out[1] = amp * 4
  }
}
