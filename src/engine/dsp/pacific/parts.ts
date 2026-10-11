import { Svf } from '../drumVoices'
import { TAU, polyBlep } from '../util'

const PULSE_S = 0.005

/** The pulser: a pulse every 1/rate seconds, running by itself, only while a
 *  key is held (starting on the key), or not at all; any input pulse fires
 *  it too. `fired` is true on the sample a pulse starts. */
export class Pulser {
  fired = false
  high = 0
  private ph = 0
  private readonly width: number

  constructor(private readonly fs: number) {
    this.width = Math.round(PULSE_S * fs)
  }

  /** mode 0 SELF, 1 KEYS, 2 OFF. */
  step(rate: number, mode: number, held: boolean, keyDown: boolean, ext: boolean): void {
    this.fired = ext
    if (mode === 0 || (mode === 1 && held)) {
      if (mode === 1 && keyDown) {
        this.ph = 0
        this.fired = true
      } else {
        this.ph += rate / this.fs
        if (this.ph >= 1) {
          this.ph -= 1
          this.fired = true
        }
      }
    }
    if (this.fired) this.high = this.width
    else if (this.high > 0) this.high--
  }
}

/** The envelope: TRANSIENT (attack, hold SUSTAIN, decay), SUSTAINED (holds
 *  while the key is down, then decays) or CYCLE (retriggers itself). */
export class WestEnv {
  v = 0
  private stage = 0 // 0 idle, 1 attack, 2 hold, 3 decay
  private held = 0

  constructor(private readonly fs: number) {}

  trigger(): void {
    this.stage = 1
  }

  step(att: number, sus: number, dec: number, mode: number, gate: boolean): number {
    const fs = this.fs
    if (this.stage === 1) {
      this.v += (1.25 - this.v) * (1 - Math.exp(-1 / (att * fs * 0.6)))
      if (this.v >= 1) {
        this.v = 1
        this.stage = 2
        this.held = 0
      }
    } else if (this.stage === 2) {
      if (mode === 1 ? !gate : ++this.held >= sus * fs) this.stage = 3
    } else if (this.stage === 3) {
      this.v *= Math.exp(-4.6 / (dec * fs))
      if (this.v < 0.001) {
        this.v = 0
        this.stage = mode === 2 ? 1 : 0
      }
    } else if (mode === 2) this.stage = 1
    return this.v
  }
}

/** A vactrol low-pass gate: the lamp lights in a couple of milliseconds and
 *  the cell lets go slowly, more slowly the darker it gets; the filter's
 *  cutoff and (in COMBO) the level follow it, so a strike rings and closes
 *  like a hand drum. Modes 0 LP, 1 COMBO, 2 VCA. */
export class Vactrol {
  v = 0
  private readonly svf = new Svf()
  private readonly lightK: number

  constructor(private readonly fs: number) {
    this.lightK = 1 - Math.exp(-1 / (0.002 * fs))
  }

  step(x: number, ctl: number, mode: number): number {
    const c = ctl < 0 ? 0 : ctl > 1 ? 1 : ctl
    if (c > this.v) this.v += (c - this.v) * this.lightK
    else {
      const dark = 1 - this.v
      this.v += (c - this.v) * (1 - Math.exp(-1 / (0.12 * (1 + 3 * dark * dark) * this.fs)))
    }
    if (mode === 2) return x * this.v
    this.svf.process(x, 30 * Math.pow(600, this.v), 1.4, this.fs)
    return mode === 1 ? this.svf.lp * this.v : this.svf.lp
  }
}

/** The complex oscillator: a phase that runs through zero under linear FM, its
 *  waveshape (SPIKE, SQR, TRI), and TIMBRE, its sine through a folder (folds
 *  more as TIMBRE rises; SYMMETRY offsets it for even harmonics). */
export class ComplexOsc {
  shape = 0
  folded = 0
  private ph = 0

  constructor(private readonly fs: number) {}

  step(hz: number, wave: number, timbre: number, sym: number): void {
    const dt = hz / this.fs
    let t = this.ph + dt
    t -= Math.floor(t)
    this.ph = t
    const s = Math.sin(TAU * t)
    const tri = 1 - 4 * Math.abs(t - 0.5)
    if (wave === 0) this.shape = tri * tri * tri * tri * 2 - 0.4 // a narrow spike: the energy in a sharp peak
    else if (wave === 1) {
      let sq = t < 0.5 ? 1 : -1
      const ad = Math.abs(dt)
      if (ad < 0.5) {
        sq += polyBlep(t, ad)
        let t2 = t - 0.5
        if (t2 < 0) t2 += 1
        sq -= polyBlep(t2, ad)
      }
      this.shape = sq * 0.8
    } else this.shape = tri
    // the folder: each fold turns the peak back down, adding harmonics in pairs
    const g = 1 + timbre * 7
    this.folded = Math.sin((s * g + sym * 1.2) * (Math.PI / 2))
  }
}
