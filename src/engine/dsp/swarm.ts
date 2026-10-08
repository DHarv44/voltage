import { SWARM_OFFSETS as OFFSETS, swarmDetune } from '../../modules/specs/synthVoices'
import type { ModuleSpec } from '../../modules/types'
import type { MidiEvent } from '../protocol'
import { Dsp, MAX_VOICES } from './base'
import { KeyVoices } from './keyVoices'
import { C4, fastTanh, polyBlep } from './util'

const SAWS = 7

/** SWARM: seven saws per note, eight notes. See the spec. */
export class SwarmDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iCut = this.ii('cut')
  private readonly iDet = this.ii('det')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly oPoly = this.oi('poly')
  private readonly P = {
    tune: this.pi('tune'),
    detune: this.pi('detune'),
    mix: this.pi('mix'),
    spread: this.pi('spread'),
    sub: this.pi('sub'),
    cutoff: this.pi('cutoff'),
    res: this.pi('res'),
    cvamt: this.pi('cvamt'),
    att: this.pi('att'),
    rel: this.pi('rel'),
    level: this.pi('level'),
  }
  private readonly keys: KeyVoices
  private readonly ph = new Float64Array(MAX_VOICES * SAWS)
  private readonly subPh = new Float64Array(MAX_VOICES)
  private readonly env = new Float64Array(MAX_VOICES)
  private readonly pitch = new Float64Array(MAX_VOICES)
  // a 12 dB state-variable low-pass per note and side
  private readonly s1L = new Float64Array(MAX_VOICES)
  private readonly s2L = new Float64Array(MAX_VOICES)
  private readonly s1R = new Float64Array(MAX_VOICES)
  private readonly s2R = new Float64Array(MAX_VOICES)
  private readonly gainL = new Float64Array(SAWS)
  private readonly gainR = new Float64Array(SAWS)
  private lastSpread = -1
  /** Each saw's own slight mistuning (cents), as real oscillators have. */
  private readonly drift = new Float64Array(SAWS)

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.keys = new KeyVoices(fs)
    for (let i = 0; i < SAWS; i++) this.drift[i] = 1 + (this.rng.next() - 0.5) * 0.0004
    for (let i = 0; i < this.ph.length; i++) this.ph[i] = this.rng.next()
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev)
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    // equal-power pan per saw: the centre in the middle, pairs fanning out
    if (p[this.P.spread] !== this.lastSpread) {
      this.lastSpread = p[this.P.spread]
      for (let i = 0; i < SAWS; i++) {
        const pan = ((i - 3) / 3) * this.lastSpread
        this.gainL[i] = Math.sqrt((1 - pan) / 2) * Math.SQRT2
        this.gainR[i] = Math.sqrt((1 + pan) / 2) * Math.SQRT2
      }
    }
    const det = swarmDetune(Math.min(1, Math.max(0, p[this.P.detune] + this.in[this.iDet] / 10)))
    const m = p[this.P.mix]
    const centre = -0.55366 * m + 0.99785 // swarmMix(m), unrolled: no array per sample
    const side = -0.73764 * m * m + 1.2841 * m + 0.044372
    const sub = p[this.P.sub]
    const tune = p[this.P.tune] / 12
    const k = 2 - 1.9 * p[this.P.res]
    const aK = 1 / (p[this.P.att] * fs)
    const rK = Math.exp(-6.9 / (p[this.P.rel] * fs))

    // where the notes come from: GATE cables, a bare V/OCT (a drone), or the keys
    const cvGate = this.patched[this.iGate] === 1
    const drone = !cvGate && this.patched[this.iV] === 1
    // a mono gate over a poly V/OCT gates the whole chord
    const n = cvGate ? Math.max(this.inChans(this.iGate), this.inChans(this.iV)) : drone ? this.inChans(this.iV) : MAX_VOICES

    let L = 0
    let R = 0
    for (let v = 0; v < n; v++) {
      let g: boolean
      if (cvGate) {
        g = this.pin(this.iGate, v) > 1
        this.pitch[v] = this.pin(this.iV, v)
      } else if (drone) {
        g = true
        this.pitch[v] = this.pin(this.iV, v)
      } else {
        g = this.keys.held(v)
        this.pitch[v] = this.keys.pitch[v]
      }
      let e = this.env[v]
      e = g ? Math.min(1, e + aK) : e * rK
      if (e < 1e-5) e = 0
      this.env[v] = e
      this.led[v] = e
      if (e === 0) {
        this.pout(this.oPoly, v, 0)
        continue
      }

      const f = C4 * Math.pow(2, this.pitch[v] + tune)
      let l = 0
      let r = 0
      const o = v * SAWS
      for (let i = 0; i < SAWS; i++) {
        const dt = Math.min(0.45, (f * (1 + OFFSETS[i] * det) * this.drift[i]) / fs)
        let ph = this.ph[o + i] + dt
        if (ph >= 1) ph -= 1
        this.ph[o + i] = ph
        const s = (2 * ph - 1 - polyBlep(ph, dt)) * (i === 3 ? centre : side)
        l += s * this.gainL[i]
        r += s * this.gainR[i]
      }
      if (sub > 0) {
        const dt = Math.min(0.45, (f * 0.5) / fs)
        let ph = this.subPh[v] + dt
        if (ph >= 1) ph -= 1
        this.subPh[v] = ph
        let sq = ph < 0.5 ? 1 : -1
        sq += polyBlep(ph, dt) - polyBlep((ph + 0.5) % 1, dt)
        l += sq * sub * 0.8
        r += sq * sub * 0.8
      }

      // the filter: cutoff follows CUTOFF CV (1 V/oct × CV AMT) and a little of the note
      const fc = Math.min(fs * 0.45, p[this.P.cutoff] * Math.pow(2, this.pin(this.iCut, v) * p[this.P.cvamt] + this.pitch[v] * 0.3))
      const gg = Math.tan((Math.PI * fc) / fs)
      const a1 = 1 / (1 + gg * (gg + k))
      const a2 = gg * a1
      const a3 = gg * a2
      let v3 = l - this.s2L[v]
      let v1 = a1 * this.s1L[v] + a2 * v3
      let v2 = this.s2L[v] + a2 * this.s1L[v] + a3 * v3
      this.s1L[v] = 2 * v1 - this.s1L[v]
      this.s2L[v] = 2 * v2 - this.s2L[v]
      l = v2
      v3 = r - this.s2R[v]
      v1 = a1 * this.s1R[v] + a2 * v3
      v2 = this.s2R[v] + a2 * this.s1R[v] + a3 * v3
      this.s1R[v] = 2 * v1 - this.s1R[v]
      this.s2R[v] = 2 * v2 - this.s2R[v]
      r = v2

      l *= e * 0.32
      r *= e * 0.32
      this.pout(this.oPoly, v, 2.5 * (l + r) * p[this.P.level])
      L += l
      R += r
    }
    for (let v = n; v < MAX_VOICES; v++) this.led[v] = 0
    this.chans[this.oPoly] = n
    const lv = 5 * p[this.P.level]
    this.out[this.oL] = lv * fastTanh(L)
    this.out[this.oR] = lv * fastTanh(R)
  }
}
