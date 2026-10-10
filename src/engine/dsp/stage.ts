import type { ModuleSpec } from '../../modules/types'
import type { MidiEvent } from '../protocol'
import { Dsp, MAX_VOICES } from './base'
import { KeyVoices, SusGate } from './keyVoices'
import { REED, StageVoice, TINE } from './stageVoice'
import { TAU } from './util'

/** STAGE: eight modelled electric-piano keys (see stageVoice.ts), a preamp
 *  and the tremolo: TINE pans speaker to speaker, REED pulses in volume. */
export class StageDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iVel = this.ii('vel')
  private readonly iSus = this.ii('sus')
  private readonly P = {
    model: this.pi('model'),
    voicing: this.pi('voicing'),
    bell: this.pi('bell'),
    decay: this.pi('decay'),
    drive: this.pi('drive'),
    trem: this.pi('trem'),
    rate: this.pi('rate'),
    level: this.pi('level'),
  }
  private readonly keys: KeyVoices
  private readonly sus = new SusGate()
  private readonly voices: StageVoice[]
  private readonly rawWas = new Uint8Array(MAX_VOICES)
  private readonly gateWas = new Uint8Array(MAX_VOICES)
  private readonly thumpK: number
  private readonly thumpDecay: number
  private trem = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.keys = new KeyVoices(fs)
    this.voices = Array.from({ length: MAX_VOICES }, () => new StageVoice())
    this.thumpK = 1 - Math.exp((-TAU * 160) / fs)
    this.thumpDecay = Math.exp(-1 / (0.03 * fs))
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev)
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const model = Math.round(p[this.P.model]) === REED ? REED : TINE
    const voicing = p[this.P.voicing]
    const cvGate = this.patched[this.iGate] === 1
    const n = cvGate ? Math.max(this.inChans(this.iGate), this.inChans(this.iV)) : MAX_VOICES
    const velPatched = this.patched[this.iVel] === 1
    const pedal = this.in[this.iSus] > 1

    let sum = 0
    for (let v = 0; v < MAX_VOICES; v++) {
      const sv = this.voices[v]
      if (v < n) {
        let raw: boolean
        let pitch: number
        let vel: number
        if (cvGate) {
          raw = this.pin(this.iGate, v) > 1
          pitch = this.pin(this.iV, v)
          vel = velPatched ? Math.min(1, Math.max(0, this.pin(this.iVel, v) / 10)) : 0.7
        } else {
          raw = this.keys.held(v)
          pitch = this.keys.pitch[v] + this.in[this.iV]
          vel = this.keys.vel[v]
        }
        const g = this.sus.hold(v, raw, pedal)
        if (raw && !this.rawWas[v]) sv.strike(pitch, vel, model, p[this.P.bell], p[this.P.decay], fs)
        else if (!g && this.gateWas[v]) sv.damp(fs, 0.5)
        this.rawWas[v] = raw ? 1 : 0
        this.gateWas[v] = g ? 1 : 0
      }
      const y = sv.live ? sv.step(voicing, fs, this.rng.next() * 2 - 1, this.thumpK, this.thumpDecay) : 0
      sum += y
      this.led[v] = sv.live ? Math.min(1, Math.abs(y) * 2) : 0
    }

    // the preamp: unity for a quiet note, rounding off chords and hard hits,
    // driven into grit at the top of DRIVE (a hard note alone peaks near 3 V)
    const g = 0.35 + p[this.P.drive] * p[this.P.drive] * 2.5
    const s = Math.tanh(sum * 0.45 * g) / g
    // tremolo: TINE pans across the stereo pair, REED pulses its volume
    this.trem = (this.trem + p[this.P.rate] / fs) % 1
    const depth = p[this.P.trem]
    const lfo = Math.sin(TAU * this.trem)
    const level = 5 * p[this.P.level]
    if (model === TINE) {
      this.out[0] = s * (1 - depth * (0.5 + 0.5 * lfo)) * level
      this.out[1] = s * (1 - depth * (0.5 - 0.5 * lfo)) * level
    } else {
      const a = s * (1 - depth * 0.6 * (0.5 + 0.5 * lfo)) * level
      this.out[0] = a
      this.out[1] = a
    }
  }
}
