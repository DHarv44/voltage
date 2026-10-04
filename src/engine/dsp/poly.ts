import { Dsp, MAX_VOICES } from './base'
import { EnvCore, LadderCore, OscCore } from './cores'
import { Drift } from './drift'
import { DRUM_CHANNEL, type MidiEvent } from '../protocol'
import { C4, TAU, rails } from './util'
import { power } from './power'

const RETRIG_S = 0.002

/** Polyphonic MIDI→CV with voice allocation: a free voice (oldest released
 *  first, so release tails aren't cut), else steal the oldest held voice. A
 *  stolen voice's gate drops for 2 ms so its envelope retriggers. */
export class PolyCvDsp extends Dsp {
  private pVoices = this.pi('voices')
  private readonly note = new Int32Array(MAX_VOICES).fill(-1)
  private readonly gate = new Uint8Array(MAX_VOICES)
  private readonly vel = new Float64Array(MAX_VOICES)
  private readonly pitch = new Float64Array(MAX_VOICES)
  private readonly stamp = new Float64Array(MAX_VOICES)
  private readonly lowFor = new Int32Array(MAX_VOICES)
  private clock = 0
  private mod = 0
  private bend = 0

  onMidi(ev: MidiEvent): void {
    if ((ev.kind === 'on' || ev.kind === 'off') && ev.ch === DRUM_CHANNEL) return
    const n = Math.round(this.p[this.pVoices])
    if (ev.kind === 'on') {
      let v = this.note.indexOf(ev.note)
      if (v < 0 || v >= n) {
        v = -1
        let best = Infinity
        for (let k = 0; k < n; k++) if (!this.gate[k] && this.stamp[k] < best) (best = this.stamp[k]), (v = k)
        if (v < 0) {
          for (let k = 0; k < n; k++) if (this.stamp[k] < best) (best = this.stamp[k]), (v = k)
          this.lowFor[v] = Math.round(RETRIG_S * this.fs) // steal: retrigger
        }
      } else this.lowFor[v] = Math.round(RETRIG_S * this.fs) // same note again: retrigger
      this.note[v] = ev.note
      this.pitch[v] = (ev.note - 60) / 12
      this.vel[v] = ev.vel
      this.gate[v] = 1
      this.stamp[v] = ++this.clock
    } else if (ev.kind === 'off') {
      for (let k = 0; k < MAX_VOICES; k++)
        if (this.note[k] === ev.note && this.gate[k]) {
          this.gate[k] = 0
          this.stamp[k] = ++this.clock
        }
    } else if (ev.kind === 'cc' && ev.cc === 1) this.mod = ev.value
    else if (ev.kind === 'bend') this.bend = ev.value
    else if (ev.kind === 'panic') this.gate.fill(0)
  }

  tick(): void {
    const n = Math.round(this.p[this.pVoices])
    for (let k = 0; k < 3; k++) this.chans[k] = n
    const bendV = (this.bend * 2) / 12
    for (let v = 0; v < n; v++) {
      const g = this.gate[v] === 1 && this.lowFor[v] === 0
      if (this.lowFor[v] > 0) this.lowFor[v]--
      this.pout(0, v, this.pitch[v] + bendV)
      this.pout(1, v, g ? 10 : 0)
      this.pout(2, v, (this.vel[v] / 127) * 10)
      this.led[v] = g ? 1 : 0
    }
    for (let v = n; v < MAX_VOICES; v++) this.led[v] = 0
    this.out[3] = (this.mod / 127) * 10
    this.out[4] = this.bend * 5
  }
}

/** One VCO per voice, each with its own drift and tracking error. */
export class PolyVcoDsp extends Dsp {
  private iV = this.ii('voct')
  private iFm = this.ii('fm')
  private pCoarse = this.pi('coarse')
  private pFine = this.pi('fine')
  private pPw = this.pi('pw')
  private pFm = this.pi('fm')
  private readonly osc = Array.from({ length: MAX_VOICES }, () => new OscCore())
  private readonly drift = Array.from({ length: MAX_VOICES }, () => new Drift(this.rng, this.fs))
  private readonly track = Float64Array.from({ length: MAX_VOICES }, () => this.tol(0.0035))

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    for (const o of this.osc) o.phase = this.rng.next()
  }

  tick(): void {
    const p = this.p
    const n = Math.max(this.inChans(this.iV), this.inChans(this.iFm))
    this.chans[0] = this.chans[1] = this.chans[2] = n
    const base = p[this.pCoarse] + p[this.pFine] / 12
    for (let v = 0; v < n; v++) {
      const oct = this.pin(this.iV, v) * this.track[v] + base + this.pin(this.iFm, v) * p[this.pFm] + this.drift[v].next(this.age) + power.pitchSag
      const o = this.osc[v]
      o.step(Math.min((C4 * Math.pow(2, oct)) / this.fs, 0.45), p[this.pPw])
      this.pout(0, v, o.saw * 5)
      this.pout(1, v, o.sqr * 5)
      this.pout(2, v, o.sin * 5)
    }
  }
}

/** One transistor ladder per voice. */
export class PolyLadderDsp extends Dsp {
  private iIn = this.ii('in')
  private iCv = this.ii('cv')
  private iV = this.ii('voct')
  private pCut = this.pi('cutoff')
  private pRes = this.pi('res')
  private pDrive = this.pi('drive')
  private pCv = this.pi('cv')
  private readonly cores = Array.from({ length: MAX_VOICES }, () => new LadderCore())
  private readonly ctol = Float64Array.from({ length: MAX_VOICES }, () => this.tol(0.03))
  private readonly w = TAU / (2 * this.fs)

  tick(): void {
    const p = this.p
    const n = Math.max(this.inChans(this.iIn), this.inChans(this.iCv), this.inChans(this.iV))
    this.chans[0] = n
    const k = 4 * p[this.pRes]
    for (let v = 0; v < n; v++) {
      let fc = p[this.pCut] * this.ctol[v] * Math.pow(2, this.pin(this.iCv, v) * p[this.pCv] + this.pin(this.iV, v))
      fc = fc < 5 ? 5 : fc > this.fs * 0.45 ? this.fs * 0.45 : fc
      const x = (this.pin(this.iIn, v) / 5) * p[this.pDrive] * (1 + 0.3 * k) + (this.rng.next() - 0.5) * 2e-4
      this.pout(0, v, this.cores[v].process(x, 1 - Math.exp(-fc * this.w), k) * 5)
    }
  }
}

/** One analog ADSR per voice. */
export class PolyAdsrDsp extends Dsp {
  private iGate = this.ii('gate')
  private P = { a: this.pi('a'), d: this.pi('d'), s: this.pi('s'), r: this.pi('r') }
  private readonly envs = Array.from({ length: MAX_VOICES }, () => new EnvCore(this.fs, this.tol(0.05)))

  tick(): void {
    const p = this.p
    const n = this.inChans(this.iGate)
    this.chans[0] = n
    for (let v = 0; v < n; v++)
      this.pout(0, v, 10 * this.envs[v].step(this.pin(this.iGate, v), false, p[this.P.a], p[this.P.d], p[this.P.s], p[this.P.r]))
  }
}

/** One VCA per voice (linear, LEVEL + CV). */
export class PolyVcaDsp extends Dsp {
  private iIn = this.ii('in')
  private iCv = this.ii('cv')
  private pGain = this.pi('gain')
  private pCv = this.pi('cv')

  tick(): void {
    const p = this.p
    const n = Math.max(this.inChans(this.iIn), this.inChans(this.iCv))
    this.chans[0] = n
    const cvPatched = this.patched[this.iCv] === 1
    for (let v = 0; v < n; v++) {
      const cv = cvPatched ? Math.max(0, this.pin(this.iCv, v) / 10) * p[this.pCv] : 0
      const g = Math.min(1.2, p[this.pGain] + cv)
      this.pout(0, v, rails(this.pin(this.iIn, v) * (g + 0.0003)))
    }
  }
}

/** Poly → mono sum (scaled by LEVEL), split voices 1–4, merge M1–M4 into poly. */
export class PolyMixDsp extends Dsp {
  private iIn = this.ii('in')
  private iM = [1, 2, 3, 4].map((k) => this.ii(`m${k}`))
  private oMerged = this.oi('merged')
  private pLevel = this.pi('level')

  tick(): void {
    const n = this.inChans(this.iIn)
    let sum = 0
    for (let v = 0; v < n; v++) sum += this.pin(this.iIn, v)
    this.out[0] = rails(sum * this.p[this.pLevel])
    for (let k = 0; k < 4; k++) this.out[1 + k] = k < n ? this.pin(this.iIn, k) : 0
    let m = 0
    for (let k = 0; k < 4; k++) if (this.patched[this.iM[k]]) m = k + 1
    this.chans[this.oMerged] = Math.max(1, m)
    for (let k = 0; k < Math.max(1, m); k++) this.pout(this.oMerged, k, this.in[this.iM[k]])
  }
}
