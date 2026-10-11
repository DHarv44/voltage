import { TUNINGS } from '../../modules/specs/tuning'
import { Dsp } from './base'

const SCALA = TUNINGS.length

/** TUNING: each voice's V/OCT read as a key (semitones from C4, ROOT
 *  marking degree 0), the key mapped to the tuning's degree in order (so a
 *  19-note tuning spreads its octave over 19 keys), and sent out at that
 *  degree's pitch; ROOT itself keeps its equal-tempered pitch. GLIDES keeps
 *  whatever lies between keys (a slide stays a slide). */
export class TuningDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly oOut = this.oi('out')
  private readonly P = { preset: this.pi('preset'), root: this.pi('root'), snap: this.pi('snap'), sn: this.pi('sn'), s0: this.pi('s0') }

  /** Degree d's cents (d < n) for a SCALA tuning: degree 0 is the root. */
  private scala(d: number): number {
    return d === 0 ? 0 : this.p[this.P.s0 + d - 1]
  }

  tick(): void {
    const p = this.p
    const preset = Math.round(p[this.P.preset])
    const root = Math.round(p[this.P.root])
    const glide = p[this.P.snap] >= 0.5
    const scala = preset >= SCALA
    const t = TUNINGS[Math.min(preset, SCALA - 1)]
    const n = scala ? Math.max(1, Math.round(p[this.P.sn])) : t.degrees.length
    const period = scala ? this.p[this.P.s0 + n - 1] : t.period
    const chans = this.inChans(this.iV)
    for (let v = 0; v < chans; v++) {
      const semis = this.pin(this.iV, v) * 12
      const key = Math.round(semis)
      const k = key - root
      const oct = Math.floor(k / n)
      const deg = k - oct * n
      const cents = oct * period + (scala ? this.scala(deg) : t.degrees[deg])
      this.pout(this.oOut, v, (root * 100 + cents) / 1200 + (glide ? (semis - key) / 12 : 0))
    }
    this.chans[this.oOut] = chans
  }
}
