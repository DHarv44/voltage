import { GRAND_MODELS } from '../../modules/specs/grand'
import type { ModuleSpec } from '../../modules/types'
import type { MidiEvent } from '../protocol'
import { Dsp, MAX_VOICES } from './base'
import { Biquad } from './biquad'
import { GrandVoice } from './grandVoice'
import { KeyVoices } from './keyVoices'
import { PedalPool } from './pedalPool'
import { Mode } from './modal'
import { C4, TAU } from './util'

/** Strings left free by the sustain pedal that ring along in sympathy:
 *  chromatic, two octaves from C2. */
const SYMPATHY = 24
/** The free strings ring this long (time constant, s) and, at their own
 *  pitch, this loud against what drives them: a halo, not a drone. */
const SYM_TAU = 1.2
const SYM_GAIN = 0.12
/** Strings sounding at once: more than the poly cable carries, since notes
 *  the pedal holds keep their strings while new ones are played. */
const POOL = 16
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
  private readonly voices: GrandVoice[]
  private readonly pool: PedalPool
  private readonly rawWas = new Uint8Array(MAX_VOICES)
  /** Each voice's place in the stereo field (left gain, right gain). */
  private readonly panL = new Float64Array(POOL)
  private readonly panR = new Float64Array(POOL)
  private readonly symDrive: number
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
    this.voices = Array.from({ length: POOL }, () => new GrandVoice())
    this.pool = new PedalPool(this.voices)
    this.sympathy = Array.from({ length: SYMPATHY }, () => new Mode())
    this.symDrive = SYM_GAIN * (1 - Math.exp(-1 / (SYM_TAU * fs)))
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
    for (let k = 0; k < SYMPATHY; k++) this.sympathy[k].tune(C4 * Math.pow(2, (k - 24) / 12), up ? SYM_TAU : 0.03, this.fs)
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
    const pool = this.pool
    // the pedal comes up: every note it was holding is damped
    if (!pedal) for (let i = 0; i < POOL; i++) if (pool.pedalHeld[i]) {
      pool.pedalHeld[i] = 0
      this.voices[i].damp()
    }

    // the keys: each new note takes its own strings from the pool
    for (let c = 0; c < n; c++) {
      let raw: boolean
      let pitch: number
      let vel: number
      if (cvGate) {
        raw = this.pin(this.iGate, c) > 1
        pitch = this.pin(this.iV, c)
        vel = velPatched ? Math.min(1, Math.max(0, this.pin(this.iVel, c) / 10)) : 0.65
      } else {
        raw = this.keys.held(c)
        pitch = this.keys.pitch[c] + this.in[this.iV]
        vel = this.keys.vel[c]
      }
      if (raw && !this.rawWas[c]) {
        const i = pool.down(c, pitch)
        this.voices[i].strike(pitch, vel, soft, m, p[this.P.bright], p[this.P.decay], p[this.P.unison], m.knock * p[this.P.hammer] * 2, fs, this.rng)
        // the player's view: bass on the left, treble on the right
        const pan = Math.max(-1, Math.min(1, (pitch + 0.5) / 3.5)) * width
        this.panL[i] = Math.cos((pan + 1) * 0.25 * Math.PI) * Math.SQRT2
        this.panR[i] = Math.sin((pan + 1) * 0.25 * Math.PI) * Math.SQRT2
      } else if (!raw && this.rawWas[c]) {
        const i = pool.up(c, pedal)
        if (i >= 0) this.voices[i].damp()
      }
      this.rawWas[c] = raw ? 1 : 0
    }

    let l = 0
    let r = 0
    let mono = 0
    for (let i = 0; i < POOL; i++) {
      const gv = this.voices[i]
      if (!gv.live) {
        if (i < MAX_VOICES) this.led[i] = 0
        continue
      }
      const y = gv.step(this.rng.next() * 2 - 1, this.knockK, this.knockDecay)
      l += y * this.panL[i]
      r += y * this.panR[i]
      mono += y
      if (i < MAX_VOICES) this.led[i] = Math.min(1, Math.abs(y) * 3)
    }

    // the strings the pedal has freed ring along, faintly, with what's played
    // (driven so that a tone at a string's own pitch rings it at SYM_GAIN of
    // its level, not built up over its whole long ring)
    let sym = 0
    if (pedal) for (let k = 0; k < SYMPATHY; k++) {
      const s = this.sympathy[k]
      s.drive(mono * this.symDrive)
      sym += s.step()
    } else if (this.symLive > 0) {
      this.symLive--
      for (let k = 0; k < SYMPATHY; k++) sym += this.sympathy[k].step()
    }
    if (pedal) this.symLive = Math.round(0.3 * fs)
    l += sym
    r += sym

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
