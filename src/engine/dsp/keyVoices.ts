import { DRUM_CHANNEL, type MidiEvent } from '../protocol'
import { MAX_VOICES } from './base'

const RETRIG_S = 0.002

/** Keys → voices, for instruments that play straight from the keyboard (MIDI
 *  or the computer keys) when nothing is patched to their GATE. Same rules as
 *  POLY·CV: a free voice (the longest released first, so tails ring on),
 *  else steal the oldest held one; a stolen or repeated voice drops for 2 ms
 *  so its envelope starts again. */
export class KeyVoices {
  readonly gate = new Uint8Array(MAX_VOICES)
  /** Volts (V/OCT, 0 = C4) and velocity 0..1, per voice. */
  readonly pitch = new Float64Array(MAX_VOICES)
  readonly vel = new Float64Array(MAX_VOICES)
  private readonly note = new Int32Array(MAX_VOICES).fill(-1)
  private readonly stamp = new Float64Array(MAX_VOICES)
  private readonly lowFor = new Int32Array(MAX_VOICES)
  /** Let go while the sustain pedal (CC64) was down: sounding until it lifts. */
  private readonly sustained = new Uint8Array(MAX_VOICES)
  private pedal = false
  private clock = 0

  constructor(private readonly fs: number) {}

  midi(ev: MidiEvent, voices = MAX_VOICES): void {
    if ((ev.kind === 'on' || ev.kind === 'off') && ev.ch === DRUM_CHANNEL) return
    if (ev.kind === 'cc' && ev.cc === 64) {
      this.pedal = ev.value >= 64
      if (!this.pedal)
        for (let k = 0; k < MAX_VOICES; k++)
          if (this.sustained[k]) {
            this.sustained[k] = 0
            this.gate[k] = 0
            this.stamp[k] = ++this.clock
          }
      return
    }
    if (ev.kind === 'on') {
      let v = this.note.indexOf(ev.note)
      if (v < 0 || v >= voices) {
        v = -1
        let best = Infinity
        for (let k = 0; k < voices; k++) if (!this.gate[k] && this.stamp[k] < best) (best = this.stamp[k]), (v = k)
        if (v < 0) {
          for (let k = 0; k < voices; k++) if (this.stamp[k] < best) (best = this.stamp[k]), (v = k)
          this.lowFor[v] = Math.round(RETRIG_S * this.fs)
        }
      } else this.lowFor[v] = Math.round(RETRIG_S * this.fs)
      this.note[v] = ev.note
      this.pitch[v] = (ev.note - 60) / 12
      this.vel[v] = ev.vel / 127
      this.gate[v] = 1
      this.sustained[v] = 0
      this.stamp[v] = ++this.clock
    } else if (ev.kind === 'off') {
      for (let k = 0; k < MAX_VOICES; k++)
        if (this.note[k] === ev.note && this.gate[k] && !this.sustained[k]) {
          if (this.pedal) this.sustained[k] = 1 // the pedal holds it
          else {
            this.gate[k] = 0
            this.stamp[k] = ++this.clock
          }
        }
    } else if (ev.kind === 'panic') {
      this.gate.fill(0)
      this.sustained.fill(0)
      this.pedal = false
    }
  }

  /** The sustain pedal (CC64) is down. */
  get pedalDown(): boolean {
    return this.pedal
  }

  /** Voice v's gate this sample (call once per voice per sample). */
  held(v: number): boolean {
    if (this.lowFor[v] > 0) {
      this.lowFor[v]--
      return false
    }
    return this.gate[v] === 1
  }
}

/** A sustain pedal over gates (a SUS jack): while it's down, a voice whose
 *  gate falls keeps sounding until the pedal lifts. A new note still starts
 *  on its own gate's rising edge (callers retrigger on the raw gate, release
 *  on this one). */
export class SusGate {
  private readonly on = new Uint8Array(MAX_VOICES)

  /** Voice v's gate as it should sound, given its raw gate and the pedal. */
  hold(v: number, gate: boolean, pedal: boolean): boolean {
    if (gate) this.on[v] = 1
    else if (!pedal) this.on[v] = 0
    return this.on[v] === 1
  }
}
