import { Dsp } from './base'
import { Schmitt } from './cores'
import { Svf } from './drumVoices'

/** The lamp lights in about 2 ms; a strike holds it on this long. */
const LIGHT_S = 0.002
const STRIKE_S = 0.003
/** Filter range as the cell opens (Hz), and its gentle damping (no peak). */
const F_MIN = 30
const F_SPAN = 600
const DAMP = 1.5

/** One gate: a vactrol (state 0..1) driving a two-pole low-pass and/or a VCA. */
class Gate {
  v = 0
  strike = 0
  readonly trig = new Schmitt()
  readonly svf = new Svf()
}

/** LPG: two vactrol low-pass gates. Control = OFFSET + CV×AMT (0–10 V), or a
 *  STRIKE's short flash. The cell follows it fast going up and slowly coming
 *  down (DECAY), and slower the darker it gets, which is what makes a struck
 *  LPG ring like a hand drum. COMBO closes the filter and the level together. */
export class LpgDsp extends Dsp {
  private ch = [1, 2].map((n) => ({
    iIn: this.ii(`in${n}`), iCv: this.ii(`cv${n}`), iStrike: this.ii(`strike${n}`), out: this.oi(`out${n}`),
    off: this.pi(`off${n}`), amt: this.pi(`amt${n}`), dec: this.pi(`dec${n}`), mode: this.pi(`mode${n}`),
  }))
  private readonly gates = [new Gate(), new Gate()]
  private readonly lightK = 1 - Math.exp(-1 / (LIGHT_S * this.fs))
  private readonly strikeN = Math.round(STRIKE_S * this.fs)

  tick(): void {
    const i = this.in
    const p = this.p
    for (let c = 0; c < 2; c++) {
      const C = this.ch[c]
      const g = this.gates[c]
      if (g.trig.rise(i[C.iStrike])) g.strike = this.strikeN
      let ctl = p[C.off] + (p[C.amt] * i[C.iCv]) / 10
      if (g.strike > 0) {
        g.strike--
        ctl = 1
      }
      ctl = ctl < 0 ? 0 : ctl > 1 ? 1 : ctl
      if (ctl > g.v) g.v += (ctl - g.v) * this.lightK
      else {
        // darker cells let go more slowly (the photocell's memory)
        const dark = 1 - g.v
        g.v += (ctl - g.v) * (1 - Math.exp(-1 / (p[C.dec] * (1 + 3 * dark * dark) * this.fs)))
      }
      const x = i[C.iIn]
      const mode = Math.round(p[C.mode])
      let y: number
      if (mode === 0) y = x * g.v
      else {
        const fc = F_MIN * Math.pow(F_SPAN, g.v)
        g.svf.process(x, fc, DAMP, this.fs)
        y = mode === 1 ? g.svf.lp * g.v : g.svf.lp
      }
      this.out[C.out] = y
    }
  }
}
