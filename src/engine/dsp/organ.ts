import { DB_SEMIS } from '../../modules/specs/instruments2'
import type { MidiEvent } from '../protocol'
import { Dsp, MAX_VOICES } from './base'
import { DelayLine } from './delayLine'
import { KeyVoices } from './keyVoices'
import { fastTanh } from './util'

const TABLE = 2048
const SINE = Float32Array.from({ length: TABLE + 1 }, (_, i) => Math.sin((2 * Math.PI * i) / TABLE))
/** The tonewheels run from about C1 to F#7: drawbars past either end fold back an octave. */
const WHEEL_LO = 24
const WHEEL_HI = 102
/** The scanner: delay swing (ms) for V1–V3 (C1–C3 the same, mixed with the dry). */
const SCAN_MS = [0, 0.25, 0.5, 0.9, 0.25, 0.5, 0.9]
const SCAN_HZ = 6.9

/** DRAWBAR: each held note sounds nine tonewheel sines at its drawbar
 *  footages (each step about 3 dB), the top and bottom folding back where
 *  the wheels run out; a percussion envelope on the 2nd or 3rd harmonic
 *  (only when every key was up: single-triggered, and it takes the 1′ bar
 *  away while on); key contacts that click; a little of every wheel leaking
 *  through; the scanner vibrato/chorus; then the preamp. */
export class OrganDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iG = this.ii('gate')
  private readonly oOut = this.oi('out')
  private readonly P = Object.fromEntries(['perc', 'pdec', 'vib', 'click', 'leak', 'drive', 'level', 'd0'].map((id) => [id, this.pi(id)])) as Record<string, number>
  private readonly keys: KeyVoices
  /** Per voice: its note (MIDI, −1 silent), gate level, the 9 phases, a click burst. */
  private readonly note = new Float64Array(MAX_VOICES).fill(-1)
  private readonly amp = new Float64Array(MAX_VOICES)
  private readonly was = new Uint8Array(MAX_VOICES)
  private readonly ph = new Float64Array(MAX_VOICES * 9)
  private readonly click = new Float64Array(MAX_VOICES)
  /** Each drawbar's wheel offset from 12-TET (gear ratios aren't exact): cents. */
  private readonly gearCents = new Float64Array(128)
  private readonly bars = new Float64Array(9)
  private perc = 0
  private percPh = 0
  private percInc = 0
  /** Each voice's nine wheel increments (cycles per sample), set at note-on. */
  private readonly inc = new Float64Array(MAX_VOICES * 9)
  private readonly scan: DelayLine
  private scanPh = 0
  private readonly ms: number
  private gk = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.keys = new KeyVoices(this.fs)
    this.ms = this.fs / 1000
    this.scan = new DelayLine(Math.ceil(4 * this.ms))
    for (let n = 0; n < 128; n++) this.gearCents[n] = (this.rng.next() - 0.5) * 0.8
    this.gk = 1 - Math.exp(-1 / (0.002 * this.fs))
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev)
  }

  private hz(n: number): number {
    while (n < WHEEL_LO) n += 12
    while (n > WHEEL_HI) n -= 12
    return 440 * Math.pow(2, (n - 69 + this.gearCents[n | 0] / 100) / 12)
  }

  tick(): void {
    const p = this.p
    const P = this.P
    const cable = this.patched[this.iG] === 1
    const percOn = Math.round(p[P.perc])
    for (let j = 0; j < 9; j++) {
      const d = Math.round(p[P.d0 + j])
      this.bars[j] = d === 0 || (j === 8 && percOn > 0) ? 0 : Math.pow(10, ((d - 8) * 3) / 20)
    }
    let anyHeld = false
    for (let v = 0; v < MAX_VOICES; v++) if (this.was[v]) anyHeld = true
    let y = 0
    const leak = p[P.leak] * 0.012
    for (let v = 0; v < MAX_VOICES; v++) {
      const g = cable ? this.pin(this.iG, v) > 1 : this.keys.held(v)
      if (g && !this.was[v]) {
        this.note[v] = Math.round(60 + (cable ? this.pin(this.iV, v) : this.keys.pitch[v]) * 12)
        for (let j = 0; j < 9; j++) this.inc[v * 9 + j] = this.hz(this.note[v] + DB_SEMIS[j]) / this.fs
        this.click[v] = 1
        if (!anyHeld && percOn > 0) {
          this.perc = 1
          this.percInc = this.hz(this.note[v] + (percOn === 1 ? 12 : 19)) / this.fs
        }
      }
      this.was[v] = g ? 1 : 0
      this.amp[v] += ((g ? 1 : 0) - this.amp[v]) * this.gk
      if (this.amp[v] < 1e-4 || this.note[v] < 0) continue
      let s = 0
      for (let j = 0; j < 9; j++) {
        const k = v * 9 + j
        let ph = this.ph[k] + this.inc[k]
        if (ph >= 1) ph -= 1
        this.ph[k] = ph
        const w = SINE[(ph * TABLE) | 0]
        s += w * (this.bars[j] + leak)
      }
      // the key's contacts: a short burst of bright clicks as it goes down
      if (this.click[v] > 0.001) {
        s += (this.rng.next() * 2 - 1) * this.click[v] * p[P.click] * 0.8
        this.click[v] *= 0.993
      }
      y += s * this.amp[v]
    }
    // percussion: one envelope, on the second or third harmonic of the first note
    if (this.perc > 1e-4) {
      this.percPh = (this.percPh + this.percInc) % 1
      y += SINE[(this.percPh * TABLE) | 0] * this.perc * 0.9
      this.perc *= Math.exp(-4.6 / ((p[P.pdec] >= 0.5 ? 1 : 0.22) * this.fs))
    }
    // the scanner vibrato / chorus
    const vib = Math.round(p[P.vib])
    this.scan.write(y)
    if (vib > 0) {
      this.scanPh = (this.scanPh + SCAN_HZ / this.fs) % 1
      const tri = this.scanPh < 0.5 ? this.scanPh * 4 - 1 : 3 - this.scanPh * 4
      const wet = this.scan.tapLin((1.2 + tri * SCAN_MS[vib]) * this.ms)
      y = vib >= 4 ? (y + wet) * 0.6 : wet
    }
    // the preamp
    const d = p[P.drive]
    this.out[this.oOut] = (fastTanh(y * 0.25 * (1 + d * 5)) / (0.55 + d * 0.6)) * 5 * p[P.level]
  }
}
