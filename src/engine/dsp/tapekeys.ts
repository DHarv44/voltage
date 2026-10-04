import type { ModuleSpec } from '../../modules/types'
import { TAPE_SECONDS } from '../../modules/specs/tapekeys'
import { DRUM_CHANNEL, type MidiEvent } from '../protocol'
import { Biquad, Changed } from './biquad'
import { Dsp, MAX_VOICES } from './base'
import { C4, polyBlep, TAU } from './util'

const KEYS = 128
const REWIND = 10
const LIFT_S = 0.04
const STRINGS = 0
const FLUTE = 1
const CHOIR = 2

/** Tape replay keyboard. State is per key (each key owns a tape strip). */
export class TapeKeysDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iSpeed = this.ii('speed')
  private readonly pSound = this.pi('sound')
  private readonly pVol = this.pi('vol')
  private readonly pTone = this.pi('tone')
  private readonly pSpeed = this.pi('speed')
  private readonly pWow = this.pi('wow')
  private readonly midiHeld = new Uint8Array(KEYS)
  private readonly cvNote = new Int32Array(MAX_VOICES).fill(-1)
  private readonly held = new Uint8Array(KEYS)
  private readonly pos = new Float64Array(KEYS)
  private readonly lift = new Float64Array(KEYS)
  private readonly ph = new Float64Array(KEYS * 3)
  private readonly wowPh: Float64Array
  private lastKey = -1
  private flutter = 0
  private seed = 1
  private breath = 0
  private readonly mixLp: Biquad
  private readonly f1: Biquad
  private readonly f2: Biquad
  private readonly toneChanged = new Changed()
  private readonly liftK: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.wowPh = Float64Array.from({ length: KEYS }, () => this.rng.next())
    this.mixLp = new Biquad(fs)
    this.f1 = new Biquad(fs).bandpass(750, 3)
    this.f2 = new Biquad(fs).bandpass(1150, 4)
    this.liftK = Math.exp(-1 / (LIFT_S * fs))
  }

  onMidi(ev: MidiEvent): void {
    if ((ev.kind === 'on' || ev.kind === 'off') && ev.ch === DRUM_CHANNEL) return
    if (ev.kind === 'on') this.midiHeld[ev.note] = 1
    else if (ev.kind === 'off') this.midiHeld[ev.note] = 0
    else if (ev.kind === 'panic') this.midiHeld.fill(0)
  }

  private noise(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
    return this.seed / 2147483648
  }

  /** The note recorded on key k's tape, `t` seconds in (a played performance:
   *  swell, then vibrato that arrives late, as a player would). */
  private voice(k: number, t: number, sound: number, rate: number): number {
    const f = C4 * Math.pow(2, (k - 60) / 12) * rate
    const vibOn = Math.min(1, Math.max(0, (t - 0.6) / 0.8))
    const vib = 1 + vibOn * 0.004 * Math.sin(TAU * 5.4 * t)
    const fs = this.fs
    const o = k * 3
    if (sound === FLUTE) {
      const dt = (f * vib) / fs
      this.ph[o] = (this.ph[o] + dt) % 1
      const env = Math.min(1, t / 0.06) * (1 - 0.15 * Math.min(1, t / 3))
      const chiff = Math.exp(-t / 0.03)
      return env * (Math.sin(TAU * this.ph[o]) + 0.12 * Math.sin(2 * TAU * this.ph[o])) + chiff * this.noise() * 0.25 + env * this.noise() * 0.02
    }
    // strings and choir: three bowed/sung voices, slightly apart
    let s = 0
    for (let d = 0; d < 3; d++) {
      const dt = (f * vib * (1 + (d - 1) * 0.0035)) / fs
      const p = (this.ph[o + d] + dt) % 1
      this.ph[o + d] = p
      s += 2 * p - 1 - polyBlep(p, dt)
    }
    const env = Math.min(1, t / (sound === CHOIR ? 0.4 : 0.25)) * (1 - 0.2 * Math.min(1, t / 6))
    return s * env * 0.33
  }

  tick(): void {
    const p = this.p
    const sound = Math.round(p[this.pSound])
    if (this.toneChanged.test(p[this.pTone], sound)) this.mixLp.lowpass(2500 + p[this.pTone] * 9000, 0.6)

    // Keys held from MIDI or from the poly CV/gate inputs.
    const n = this.patched[this.iGate] ? this.inChans(this.iGate) : 0
    for (let c = 0; c < MAX_VOICES; c++) {
      const on = c < n && this.pin(this.iGate, c) > 1
      const note = on ? Math.max(0, Math.min(KEYS - 1, Math.round(60 + this.pin(this.iV, c) * 12))) : -1
      this.cvNote[c] = note
    }
    const dt = 1 / this.fs
    const rate = Math.pow(2, p[this.pSpeed] / 12 + this.in[this.iSpeed])
    this.flutter = (this.flutter + 9.3 * dt) % 1
    const wowAmt = p[this.pWow]
    let y = 0
    let playing = 0
    for (let k = 0; k < KEYS; k++) {
      let h = this.midiHeld[k]
      if (!h) for (let c = 0; c < n; c++) if (this.cvNote[c] === k) h = 1
      if (h && !this.held[k]) this.lastKey = k
      this.held[k] = h
      if (h) {
        this.lift[k] = 1
        this.pos[k] += dt * rate
      } else {
        this.lift[k] *= this.liftK
        this.pos[k] = Math.max(0, this.pos[k] - dt * REWIND) // spring rewind
      }
      if (this.lift[k] < 1e-4) continue
      const t = this.pos[k]
      if (t >= TAPE_SECONDS) continue // ran off the end of the strip
      this.wowPh[k] = (this.wowPh[k] + 0.7 * dt) % 1
      const w = 1 + wowAmt * (0.003 * Math.sin(TAU * this.wowPh[k]) + 0.001 * Math.sin(TAU * this.flutter))
      y += this.voice(k, t, sound, rate * w) * this.lift[k] * Math.min(1, (TAPE_SECONDS - t) / 0.05)
      playing++
    }
    if (sound === CHOIR) y = this.f1.run(y) * 2.2 + this.f2.run(y) * 1.4
    this.breath += (this.noise() - this.breath) * 0.3
    y = this.mixLp.run(y) + this.breath * 0.004 * Math.sqrt(playing) // each running tape adds hiss
    this.out[0] = Math.tanh(y * 0.6) * 5 * p[this.pVol]
    this.led[0] = this.lastKey >= 0 ? Math.min(1, this.pos[this.lastKey] / TAPE_SECONDS) : 0
  }
}
