import { GRAND_MODELS } from '../../modules/specs/grand'
import type { ModuleSpec } from '../../modules/types'
import type { MidiEvent } from '../protocol'
import { Dsp, MAX_VOICES } from './base'
import { Biquad } from './biquad'
import { GrandVoice } from './grandVoice'
import { KeyVoices, SusGate } from './keyVoices'
import { Mode } from './modal'
import { C4, TAU } from './util'

/** Strings left free by the sustain pedal that ring along in sympathy:
 *  chromatic, two octaves from C2. */
const SYMPATHY = 24
/** How the soundboard's three resonances lean (dB at BODY full). */
const BODY_DB = [7, 5, 4]

/** GRAND: eight modelled piano keys (see grandVoice.ts), a sustain pedal
 *  that lifts every damper (the undamped strings ring in sympathy), the una
 *  corda, the soundboard, and the keys spread across the stereo field as
 *  the player hears them (bass left, treble right). */
export class GrandDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iVel = this.ii('vel')
  private readonly iSus = this.ii('sus')
  private readonly iSoft = this.ii('soft')
  private readonly P = {
    model: this.pi('model'),
    bright: this.pi('bright'),
    decay: this.pi('decay'),
    unison: this.pi('unison'),
    body: this.pi('body'),
    hammer: this.pi('hammer'),
    width: this.pi('width'),
    level: this.pi('level'),
  }
  private readonly keys: KeyVoices
  private readonly sus = new SusGate()
  private readonly voices: GrandVoice[]
  private readonly rawWas = new Uint8Array(MAX_VOICES)
  private readonly gateWas = new Uint8Array(MAX_VOICES)
  /** Each key's place in the stereo field (left gain, right gain). */
  private readonly panL = new Float64Array(MAX_VOICES)
  private readonly panR = new Float64Array(MAX_VOICES)
  private readonly sympathy: Mode[]
  private readonly bodyL: Biquad[]
  private readonly bodyR: Biquad[]
  /** What the soundboard filters were last shaped for. */
  private bodyModel = -1
  private bodyAmt = -1
  private readonly knockK: number
  private readonly knockDecay: number
  private pedalWas = false

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.keys = new KeyVoices(fs)
    this.voices = Array.from({ length: MAX_VOICES }, () => new GrandVoice())
    this.sympathy = Array.from({ length: SYMPATHY }, () => new Mode())
    this.bodyL = [0, 1, 2].map(() => new Biquad(fs))
    this.bodyR = [0, 1, 2].map(() => new Biquad(fs))
    this.knockK = 1 - Math.exp((-TAU * 900) / fs)
    this.knockDecay = Math.exp(-1 / (0.012 * fs))
    this.tuneSympathy(false)
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev)
  }

  /** The free strings: long-ringing with the dampers up, quickly hushed when they land. */
  private tuneSympathy(up: boolean): void {
    for (let k = 0; k < SYMPATHY; k++) this.sympathy[k].tune(C4 * Math.pow(2, (k - 24) / 12), up ? 1.2 : 0.03, this.fs)
  }

  /** The soundboard's resonances for this MODEL and BODY (only when they change). */
  private shapeBody(model: number, body: number): void {
    if (model === this.bodyModel && body === this.bodyAmt) return
    this.bodyModel = model
    this.bodyAmt = body
    const m = GRAND_MODELS[model]
    for (let i = 0; i < 3; i++) {
      this.bodyL[i].peak(m.body[i], m.bodyQ, BODY_DB[i] * body)
      this.bodyR[i].peak(m.body[i], m.bodyQ, BODY_DB[i] * body)
    }
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const model = Math.max(0, Math.min(GRAND_MODELS.length - 1, Math.round(p[this.P.model])))
    const m = GRAND_MODELS[model]
    if ((this.n32 = (this.n32 + 1) & 31) === 0) this.shapeBody(model, p[this.P.body])
    const cvGate = this.patched[this.iGate] === 1
    const n = cvGate ? Math.max(this.inChans(this.iGate), this.inChans(this.iV)) : MAX_VOICES
    const velPatched = this.patched[this.iVel] === 1
    const pedal = this.in[this.iSus] > 1 || this.keys.pedalDown
    const soft = this.in[this.iSoft] > 1
    if (pedal !== this.pedalWas) {
      this.pedalWas = pedal
      this.tuneSympathy(pedal)
    }
    const width = p[this.P.width]

    let l = 0
    let r = 0
    let mono = 0
    for (let v = 0; v < MAX_VOICES; v++) {
      const gv = this.voices[v]
      if (v < n) {
        let raw: boolean
        let pitch: number
        let vel: number
        if (cvGate) {
          raw = this.pin(this.iGate, v) > 1
          pitch = this.pin(this.iV, v)
          vel = velPatched ? Math.min(1, Math.max(0, this.pin(this.iVel, v) / 10)) : 0.65
        } else {
          raw = this.keys.held(v)
          pitch = this.keys.pitch[v] + this.in[this.iV]
          vel = this.keys.vel[v]
        }
        const g = this.sus.hold(v, raw, pedal)
        if (raw && !this.rawWas[v]) {
          gv.strike(pitch, vel, soft, m, p[this.P.bright], p[this.P.decay], p[this.P.unison], m.knock * p[this.P.hammer] * 2, fs, this.rng)
          // the player's view: bass on the left, treble on the right
          const pan = Math.max(-1, Math.min(1, (pitch + 0.5) / 3.5)) * width
          this.panL[v] = Math.cos((pan + 1) * 0.25 * Math.PI) * Math.SQRT2
          this.panR[v] = Math.sin((pan + 1) * 0.25 * Math.PI) * Math.SQRT2
        } else if (!g && this.gateWas[v]) gv.damp()
        this.rawWas[v] = raw ? 1 : 0
        this.gateWas[v] = g ? 1 : 0
      }
      if (!gv.live) {
        this.led[v] = 0
        continue
      }
      const y = gv.step(this.rng.next() * 2 - 1, this.knockK, this.knockDecay)
      l += y * this.panL[v]
      r += y * this.panR[v]
      mono += y
      this.led[v] = Math.min(1, Math.abs(y) * 3)
    }

    // the strings the pedal has freed ring along with what's played
    let sym = 0
    if (pedal) for (let k = 0; k < SYMPATHY; k++) {
      const s = this.sympathy[k]
      s.drive(mono * 0.0025)
      sym += s.step()
    } else if (this.symLive > 0) {
      this.symLive--
      for (let k = 0; k < SYMPATHY; k++) sym += this.sympathy[k].step()
    }
    if (pedal) this.symLive = Math.round(0.3 * fs)
    l += sym * 0.6
    r += sym * 0.6

    // the soundboard, then a gentle limit
    for (let i = 0; i < 3; i++) {
      l = this.bodyL[i].run(l)
      r = this.bodyR[i].run(r)
    }
    const level = 5 * p[this.P.level]
    this.out[0] = Math.tanh(l * 0.9) * level
    this.out[1] = Math.tanh(r * 0.9) * level
  }

  private n32 = 0
  /** Samples the freed strings keep ringing after the pedal comes up. */
  private symLive = 0
}
