import { Dsp } from './base'
import { Biquad, Changed } from './biquad'
import { VOC_BANDS, vocBand } from '../../modules/specs/voiceFx'
import { C4, fastTanh, polyBlep } from './util'

const SIB_HZ = 5000
/** Output makeup: each band passes only its slice of the carrier, so the sum
 *  needs this much to sit level with the rest of the rack. */
const TRIM = 40

/** VOCODER: sixteen bands, each a 4th-order band-pass (two biquads) on the
 *  modulator and the same on the carrier; a follower on each modulator band
 *  sets that carrier band's level. SHIFT reads analysis band k into
 *  synthesis band k + shift (formants up or down). */
export class VocoderDsp extends Dsp {
  private I = { mod: this.ii('mod'), car: this.ii('car'), voct: this.ii('voct'), frz: this.ii('frz'), shift: this.ii('shift') }
  private O = { out: this.oi('out'), env: this.oi('env') }
  private P = {
    shift: this.pi('shift'), q: this.pi('q'), att: this.pi('att'), rel: this.pi('rel'), level: this.pi('level'),
    sib: this.pi('sib'), noise: this.pi('noise'), tune: this.pi('tune'), mix: this.pi('mix'), freeze: this.pi('freeze'),
  }
  private readonly ana = Array.from({ length: VOC_BANDS * 2 }, () => new Biquad(this.fs))
  private readonly syn = Array.from({ length: VOC_BANDS * 2 }, () => new Biquad(this.fs))
  private readonly env = new Float64Array(VOC_BANDS)
  private readonly sibHp = new Biquad(this.fs).highpass(SIB_HZ)
  private readonly changed = new Changed()
  private phase = 0
  private seed = 0x1234567
  private meterTick = 0

  private white(): number {
    let x = this.seed
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.seed = x
    return (x | 0) / 0x80000000
  }

  tick(): void {
    const i = this.in
    const p = this.p
    const P = this.P
    let shift = Math.round(p[P.shift] + i[this.I.shift])
    shift = shift < -6 ? -6 : shift > 6 ? 6 : shift
    const q = 2 + p[P.q] * 10
    if (this.changed.test(shift, q))
      for (let k = 0; k < VOC_BANDS; k++) {
        const fa = vocBand(k)
        const fsyn = vocBand(k) * Math.pow(80, shift / (VOC_BANDS - 1))
        this.ana[k * 2].bandpass(fa, q)
        this.ana[k * 2 + 1].bandpass(fa, q)
        this.syn[k * 2].bandpass(fsyn, q)
        this.syn[k * 2 + 1].bandpass(fsyn, q)
      }

    // the carrier: patched, or the built-in buzz on V/OCT; NOISE for consonants
    let car: number
    if (this.patched[this.I.car]) car = i[this.I.car]
    else {
      const dt = Math.min(0.45, (C4 * Math.pow(2, i[this.I.voct] + p[P.tune])) / this.fs)
      this.phase = (this.phase + dt) % 1
      car = 5 * (2 * this.phase - 1 - polyBlep(this.phase, dt))
    }
    car += this.white() * 5 * p[P.noise]

    const mod = i[this.I.mod]
    const frozen = p[P.freeze] >= 0.5 || i[this.I.frz] > 1.2
    const kA = 1 - Math.exp(-1 / (p[P.att] * this.fs))
    const kR = 1 - Math.exp(-1 / (p[P.rel] * this.fs))
    let y = 0
    let total = 0
    for (let k = 0; k < VOC_BANDS; k++) {
      const a = Math.abs(this.ana[k * 2 + 1].run(this.ana[k * 2].run(mod)))
      if (!frozen) this.env[k] += (a - this.env[k]) * (a > this.env[k] ? kA : kR)
      const s = this.syn[k * 2 + 1].run(this.syn[k * 2].run(car))
      y += s * this.env[k]
      total += this.env[k]
    }
    // the band meter, in dB (a 48 dB window below full scale), now and then
    if (++this.meterTick >= 64) {
      this.meterTick = 0
      for (let k = 0; k < VOC_BANDS; k++) {
        const db = 20 * Math.log10(this.env[k] / 5 + 1e-9)
        this.led[k] = db < -48 ? 0 : db > 0 ? 1 : (db + 48) / 48
      }
    }
    y = (y / 5) * TRIM + this.sibHp.run(mod) * p[P.sib] + mod * p[P.mix]
    // a loud modulator saturates gently rather than clipping at the rails
    this.out[this.O.out] = 8 * fastTanh((y * p[P.level] * 1.4) / 8)
    this.out[this.O.env] = Math.min(10, (total / VOC_BANDS) * 4)
  }
}
