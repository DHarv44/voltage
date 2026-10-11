import type { MidiEvent } from '../protocol'
import { Dsp, MAX_VOICES } from './base'
import { KeyVoices } from './keyVoices'
import { C4, TAU } from './util'

/** Formants (Hz) and their levels (dB) for A E I O U: a tenor; higher
 *  voices scale up (SIZE and the note move them). F4 is the singer's formant. */
const F = [
  [650, 1080, 2650, 2900, 0, -6, -7, -8],
  [400, 1700, 2600, 3200, 0, -14, -12, -14],
  [290, 1870, 2800, 3250, 0, -15, -18, -20],
  [400, 800, 2600, 2800, 0, -10, -12, -12],
  [350, 600, 2700, 2900, 0, -20, -17, -14],
]
const BW = [80, 90, 120, 130]
const SINGERS = 3
/** EACH NOTE: the vowels a word's worth of notes walks through. */
const WORD = [0, 3, 1, 4, 2, 0, 1, 3]

/** A band-pass whose coefficients are worked out only when asked (TPT SVF). */
class Band {
  private s1 = 0
  private s2 = 0
  private g = 0.1
  private k = 0.1
  set(f: number, bw: number, fs: number): void {
    this.g = Math.tan((Math.PI * Math.min(f, fs * 0.45)) / fs)
    this.k = bw / f
  }
  run(x: number): number {
    const g = this.g
    const hp = (x - (this.k + g) * this.s1 - this.s2) / (1 + g * (this.k + g))
    const bp = g * hp + this.s1
    this.s1 = g * hp + bp
    const lp = g * bp + this.s2
    this.s2 = g * bp + lp
    return bp * this.k
  }
}

/** CHOIR: per voice, three singers (glottal pulses: a saw softened to a
 *  breathy pulse, each with its own vibrato, drift and timing) summed with
 *  aspiration noise, through the vowel's four formants. Voices spread
 *  across the stereo field. */
export class ChoirDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iG = this.ii('gate')
  private readonly iVc = this.ii('vcv')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly P = Object.fromEntries(['vowel', 'words', 'ens', 'breath', 'vib', 'size', 'att', 'rel', 'level'].map((id) => [id, this.pi(id)])) as Record<string, number>
  private readonly keys: KeyVoices
  private readonly was = new Uint8Array(MAX_VOICES)
  private readonly pitch = new Float64Array(MAX_VOICES)
  private readonly env = new Float64Array(MAX_VOICES)
  private readonly vowel = new Float64Array(MAX_VOICES)
  private readonly ph = new Float64Array(MAX_VOICES * SINGERS)
  private readonly vph = new Float64Array(MAX_VOICES * SINGERS)
  private readonly vrate = new Float64Array(MAX_VOICES * SINGERS)
  private readonly drift = new Float64Array(MAX_VOICES * SINGERS)
  private readonly glot = new Float64Array(MAX_VOICES * SINGERS)
  private readonly bands: Band[] = []
  private readonly gains = new Float64Array(MAX_VOICES * 4)
  private word = 0
  private n = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.keys = new KeyVoices(this.fs)
    for (let i = 0; i < MAX_VOICES * 4; i++) this.bands.push(new Band())
    for (let i = 0; i < MAX_VOICES * SINGERS; i++) {
      this.vrate[i] = 4.8 + this.rng.next() * 1.4
      this.vph[i] = this.rng.next()
      this.ph[i] = this.rng.next()
    }
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev, MAX_VOICES)
  }

  /** Voice v's formants for its vowel, note and SIZE. */
  private formants(v: number): void {
    const p = this.p
    const x = Math.max(0, Math.min(4, this.vowel[v]))
    const i = Math.min(3, Math.floor(x))
    const t = x - i
    // higher notes sing with smaller voices (tenor to soprano); SIZE on top
    const scale = Math.pow(2, Math.max(0, Math.min(0.35, this.pitch[v] * 0.2)) - p[this.P.size] * 0.35)
    for (let k = 0; k < 4; k++) {
      const f = (F[i][k] * (1 - t) + F[i + 1][k] * t) * (k === 3 ? 1 : scale)
      this.bands[v * 4 + k].set(f, BW[k] * (k === 3 ? 1 : scale), this.fs)
      this.gains[v * 4 + k] = Math.pow(10, (F[i][k + 4] * (1 - t) + F[i + 1][k + 4] * t) / 20)
    }
  }

  tick(): void {
    const p = this.p
    const P = this.P
    const fs = this.fs
    const cable = this.patched[this.iG] === 1
    const base = p[P.vowel] + (this.patched[this.iVc] ? this.in[this.iVc] / 2.5 : 0)
    const each = p[P.words] >= 0.5
    const refresh = this.n++ % 64 === 0
    let l = 0
    let r = 0
    for (let v = 0; v < MAX_VOICES; v++) {
      const g = cable ? this.pin(this.iG, v) > 1 : this.keys.held(v)
      if (g && !this.was[v]) {
        this.pitch[v] = cable ? this.pin(this.iV, v) : this.keys.pitch[v] + this.in[this.iV]
        this.vowel[v] = each ? WORD[this.word++ % WORD.length] : base
        this.formants(v)
      } else if (g && cable) this.pitch[v] = this.pin(this.iV, v)
      this.was[v] = g ? 1 : 0
      const t = g ? p[P.att] : p[P.rel]
      this.env[v] += ((g ? 1 : 0) - this.env[v]) * (1 - Math.exp(-1 / (t * 0.4 * fs)))
      if (this.env[v] < 1e-4) continue
      if (refresh && !each) {
        this.vowel[v] = base
        this.formants(v)
      }
      // the singers
      let src = 0
      for (let s = 0; s < SINGERS; s++) {
        const k = v * SINGERS + s
        this.vph[k] = (this.vph[k] + this.vrate[k] / fs) % 1
        this.drift[k] += ((this.rng.next() - 0.5) * 0.004 - this.drift[k] * 0.0005) * p[P.ens]
        const spread = (s - 1) * 0.006 * p[P.ens]
        const cents = Math.sin(TAU * this.vph[k]) * p[P.vib] * 0.03 + spread + this.drift[k]
        const inc = (C4 * Math.pow(2, this.pitch[v] + cents)) / fs
        this.ph[k] = (this.ph[k] + inc) % 1
        // a glottal pulse: a falling saw, its edge softened (breathier with BREATH)
        const saw = 1 - 2 * this.ph[k]
        this.glot[k] += (saw - this.glot[k]) * (0.55 - p[P.breath] * 0.35)
        src += this.glot[k]
      }
      src = src / SINGERS + (this.rng.next() * 2 - 1) * p[P.breath] * 0.35
      let y = 0
      for (let k = 0; k < 4; k++) y += this.bands[v * 4 + k].run(src) * this.gains[v * 4 + k]
      y *= this.env[v]
      const pan = ((v % 4) - 1.5) * 0.25
      l += y * (0.5 - pan)
      r += y * (0.5 + pan)
    }
    const g = p[P.level] * 16
    this.out[this.oL] = Math.tanh(l * 0.9) * g
    this.out[this.oR] = Math.tanh(r * 0.9) * g
  }
}
