import type { ModuleSpec } from '../../modules/types'
import { FM_ALGOS, FM_PATCHES } from '../../modules/specs/fmPatches'
import { FML } from '../../modules/specs/synthVoices'
import type { MidiEvent } from '../protocol'
import { Dsp, MAX_VOICES } from './base'
import { KeyVoices, SusGate } from './keyVoices'
import { C4, TAU, fastTanh } from './util'

const OPS = 4
const IDLE = 0
const ATTACK = 1
const DECAY = 2
const RELEASE = 3
/** Envelope times are to −60 dB. */
const T60 = 6.9
/** Higher notes die faster, as on a real piano or bell (per octave above C4). */
const KEY_SCALE = 0.35

/** FM-4: four sine operators per voice, eight voices. See the spec. */
export class Fm4Dsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iVel = this.ii('vel')
  private readonly iBright = this.ii('bright')
  private readonly iSus = this.ii('sus')
  private readonly oPoly = this.oi('poly')
  private readonly P = {
    voice: this.pi('voice'),
    algo: this.pi('algo'),
    tune: this.pi('tune'),
    level: this.pi('level'),
    bright: this.pi('bright'),
    decay: this.pi('decay'),
    fb: this.pi('fb'),
    detune: this.pi('detune'),
    att: this.pi('att'),
    rel: this.pi('rel'),
    velo: this.pi('velo'),
  }
  private readonly keys: KeyVoices
  private readonly sus = new SusGate()
  // per voice × operator
  private readonly ph = new Float64Array(MAX_VOICES * OPS)
  private readonly env = new Float64Array(MAX_VOICES * OPS)
  private readonly stage = new Uint8Array(MAX_VOICES * OPS)
  private readonly atk = new Float64Array(MAX_VOICES * OPS)
  private readonly dec = new Float64Array(MAX_VOICES * OPS)
  private readonly relK = new Float64Array(MAX_VOICES * OPS)
  // per voice
  private readonly fb1 = new Float64Array(MAX_VOICES)
  private readonly fb2 = new Float64Array(MAX_VOICES)
  private readonly gateWas = new Uint8Array(MAX_VOICES)
  /** The gate before the sustain pedal: a new note starts on its rising edge. */
  private readonly rawWas = new Uint8Array(MAX_VOICES)
  /** The damper's thump on release: its envelope and a low-passed noise. */
  private readonly thumpE = new Float64Array(MAX_VOICES)
  private readonly thumpLp = new Float64Array(MAX_VOICES)
  private readonly thumpK: number
  private readonly thumpDecay: number
  private readonly vel = new Float64Array(MAX_VOICES)
  private readonly pitch = new Float64Array(MAX_VOICES)
  private readonly opOut = new Float64Array(OPS)
  /** The envelope settings the coefficients were worked out for. */
  private readonly coefKey = new Float64Array(4).fill(-1)
  private readonly drift = new Float64Array(OPS)
  /** The last note started: its operators light the screen. */
  private newest = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.keys = new KeyVoices(fs)
    for (let k = 0; k < OPS; k++) this.drift[k] = (this.rng.next() - 0.5) * 0.6 // cents
    this.thumpK = 1 - Math.exp((-TAU * 180) / fs) // a felt damper: dull, low
    this.thumpDecay = Math.exp(-1 / (0.035 * fs))
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev)
  }

  /** Envelope coefficients for voice v (its note scales the decays). */
  private coefs(v: number): void {
    const p = this.p
    const patch = FM_PATCHES[Math.round(p[this.P.voice])]
    const decayX = Math.pow(4, (p[this.P.decay] - 0.5) * 2) * Math.pow(2, -this.pitch[v] * KEY_SCALE)
    const relX = Math.pow(4, (p[this.P.rel] - 0.5) * 2)
    const addA = p[this.P.att] * p[this.P.att] * 3
    const carriers = FM_ALGOS[this.algoOf(patch.algo)].carriers
    const fs = this.fs
    for (let k = 0; k < OPS; k++) {
      const o = patch.ops[k]
      const i = v * OPS + k
      const a = o.a + ((carriers >> k) & 1 ? addA : addA * 0.6)
      this.atk[i] = 1 / (Math.max(0.0005, a) * fs)
      this.dec[i] = Math.exp(-T60 / (o.d * decayX * fs))
      this.relK[i] = Math.exp(-T60 / (o.r * relX * fs))
    }
  }

  private algoOf(own: number): number {
    const a = Math.round(this.p[this.P.algo])
    return a === 0 ? own : a - 1
  }

  private start(v: number): void {
    for (let k = 0; k < OPS; k++) {
      const i = v * OPS + k
      this.stage[i] = ATTACK
      this.ph[i] = 0 // every note starts the same way (the DX "key sync")
    }
    this.fb1[v] = this.fb2[v] = 0
    this.newest = v
    this.coefs(v)
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const patch = FM_PATCHES[Math.round(p[this.P.voice])]
    const algo = FM_ALGOS[this.algoOf(patch.algo)]
    const mods = algo.mods
    // knob moves re-time the envelopes of the notes already sounding
    const ck = this.coefKey
    if (ck[0] !== p[this.P.voice] || ck[1] !== p[this.P.decay] || ck[2] !== p[this.P.rel] || ck[3] !== p[this.P.att]) {
      ck[0] = p[this.P.voice]
      ck[1] = p[this.P.decay]
      ck[2] = p[this.P.rel]
      ck[3] = p[this.P.att]
      for (let v = 0; v < MAX_VOICES; v++) this.coefs(v)
    }

    const cvGate = this.patched[this.iGate] === 1
    // a mono gate over a poly V/OCT gates the whole chord
    const n = cvGate ? Math.max(this.inChans(this.iGate), this.inChans(this.iV)) : MAX_VOICES
    const bright = Math.max(0, p[this.P.bright] + this.in[this.iBright] / 10)
    const brightX = Math.pow(2 * bright, 1.5)
    const fbRad = Math.min(1, patch.fb * 2 * p[this.P.fb]) * 1.6
    const sens = Math.min(1, patch.velBright * 2 * p[this.P.velo])
    const detune = p[this.P.detune]
    const tune = p[this.P.tune] / 12
    const velPatched = this.patched[this.iVel] === 1
    // the sustain pedal: the SUS jack, or a MIDI pedal (CC64) on the keys
    const pedal = this.in[this.iSus] > 1
    const thump = patch.thump ?? 0

    let sum = 0
    for (let v = 0; v < n; v++) {
      // the note: from the cables, or from the keys
      let raw: boolean
      if (cvGate) {
        raw = this.pin(this.iGate, v) > 1
        if (raw && !this.rawWas[v]) {
          this.pitch[v] = this.pin(this.iV, v)
          this.vel[v] = velPatched ? Math.min(1, Math.max(0, this.pin(this.iVel, v) / 10)) : 0.8
        }
        if (raw) this.pitch[v] = this.pin(this.iV, v)
      } else {
        raw = this.keys.held(v)
        this.pitch[v] = this.keys.pitch[v] + this.in[this.iV]
        if (raw && !this.rawWas[v]) this.vel[v] = this.keys.vel[v]
      }
      const g = this.sus.hold(v, raw, pedal)
      if (raw && !this.rawWas[v]) this.start(v)
      else if (!g && this.gateWas[v]) {
        for (let k = 0; k < OPS; k++) if (this.stage[v * OPS + k] !== IDLE) this.stage[v * OPS + k] = RELEASE
        if (thump > 0) this.thumpE[v] = thump * (0.4 + 0.6 * this.vel[v])
      }
      this.rawWas[v] = raw ? 1 : 0
      this.gateWas[v] = g ? 1 : 0

      // the damper landing: a short, dull thud of low-passed noise
      let thud = 0
      if (this.thumpE[v] > 1e-4) {
        this.thumpLp[v] += (this.rng.next() * 2 - 1 - this.thumpLp[v]) * this.thumpK
        thud = this.thumpLp[v] * this.thumpE[v] * 0.6
        this.thumpE[v] *= this.thumpDecay
      } else this.thumpE[v] = 0

      const base = v * OPS
      if (this.stage[base] === IDLE && this.stage[base + 1] === IDLE && this.stage[base + 2] === IDLE && this.stage[base + 3] === IDLE) {
        this.pout(this.oPoly, v, 5 * thud * p[this.P.level])
        sum += thud
        continue
      }
      const f = C4 * Math.pow(2, this.pitch[v] + tune)
      // velocity: soft notes round, hard ones bite (a curve, not a straight line:
      // the brightness climbs fastest at the top, where a real tine barks)
      const vv = this.vel[v]
      const velMod = 1 - sens + sens * (0.2 + 1.3 * vv * vv)
      // keyboard level scaling: brightness and loudness fall away up the keys
      const up = Math.max(0, this.pitch[v])
      const keyMod = Math.pow(2, -up * (patch.keyMod ?? 0))
      const velAmp = (1 - 0.5 * p[this.P.velo] + 0.5 * p[this.P.velo] * vv) * Math.pow(2, -up * (patch.keyAmp ?? 0))
      let voice = 0
      for (let k = OPS - 1; k >= 0; k--) {
        const i = base + k
        const o = patch.ops[k]
        // envelope
        let e = this.env[i]
        const st = this.stage[i]
        if (st === ATTACK) {
          e += this.atk[i]
          if (e >= 1) {
            e = 1
            this.stage[i] = DECAY
          }
        } else if (st === DECAY) e = o.s + (e - o.s) * this.dec[i]
        else if (st === RELEASE) {
          e *= this.relK[i]
          if (e < 1e-5) {
            e = 0
            this.stage[i] = IDLE
          }
        }
        this.env[i] = e
        // phase modulation from the operators wired into this one
        let m: number
        if (k === OPS - 1) m = fbRad * 0.5 * (this.fb1[v] + this.fb2[v])
        else {
          m = 0
          const mask = mods[k]
          for (let j = k + 1; j < OPS; j++) if ((mask >> j) & 1) m += this.opOut[j]
        }
        const s = Math.sin(TAU * this.ph[i] + m) * e
        if (k === OPS - 1) {
          this.fb2[v] = this.fb1[v]
          this.fb1[v] = s
        }
        if ((algo.carriers >> k) & 1) {
          voice += s * o.level
          this.opOut[k] = 0
        } else this.opOut[k] = s * o.level * brightX * velMod * keyMod
        const cents = (o.cents ?? 0) + this.drift[k] + detune * (k === 0 ? 0 : k === 1 ? 9 : k === 2 ? -9 : 4)
        this.ph[i] = (this.ph[i] + (f * o.ratio * (1 + cents * 0.000578)) / fs) % 1
      }
      voice = voice * velAmp + thud
      this.pout(this.oPoly, v, 5 * voice * p[this.P.level])
      sum += voice
    }
    this.chans[this.oPoly] = n
    this.out[0] = 5 * fastTanh(0.9 * sum) * p[this.P.level]
    // the screen: the newest note's operators, and every voice (operator 1 is a carrier in every algorithm)
    for (let k = 0; k < OPS; k++) this.led[FML.ops + k] = this.env[this.newest * OPS + k]
    for (let v = 0; v < MAX_VOICES; v++) this.led[FML.voices + v] = v < n ? this.env[v * OPS] : 0
  }
}
