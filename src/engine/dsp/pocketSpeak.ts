import type { ModuleSpec } from '../../modules/types'
import { MELODY_NOTES, PSL, PSTEPS, SCALE_STEPS } from '../../modules/specs/pocketSynth'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Svf } from './drumVoices'
import { PocketClock } from './pocketClock'
import { PocketFx } from './pocketFx'
import { PocketSong } from './pocketSong'
import { F, Formant, GAINS } from './talkbox'
import { C4, polyBlep } from './util'

const CHOIR = 1
const WHISPER = 2
// how a syllable starts
const OPEN = 0 // straight into the vowel
const VOICED = 1 // a voiced stop: a short burst, formants sliding in (d, b)
const PUFF = 2 // an unvoiced stop: a breathy puff before the voice (t)
const NASAL = 3 // a closed-mouth hum that opens (m)
const LIQUID = 4 // a glide from the tongue's l shape (l)
/** Vowel rows of the formant table. */
const U = 0
const O = 1
const A = 2
const I = 4

/** SPEAK_SYLLABLES in order: AH EE OO DA TI BO MA LA. */
const SYLLABLES: { vowel: number; kind: number; burst: number; start: number[] }[] = [
  { vowel: A, kind: OPEN, burst: 0, start: [] },
  { vowel: I, kind: OPEN, burst: 0, start: [] },
  { vowel: U, kind: OPEN, burst: 0, start: [] },
  { vowel: A, kind: VOICED, burst: 2600, start: [250, 1700, 2600] },
  { vowel: I, kind: PUFF, burst: 4500, start: [300, 1800, 2700] },
  { vowel: O, kind: VOICED, burst: 700, start: [250, 800, 2200] },
  { vowel: A, kind: NASAL, burst: 0, start: [250, 1000, 2200] },
  { vowel: A, kind: LIQUID, burst: 0, start: [360, 1300, 2700] },
]
const NASAL_S = 0.07
const PUFF_S = 0.035
const DETUNE = [0, 0.006, -0.007]

/** POCKET SPEAK: a singing voice. A source (a buzzing glottis, three detuned
 *  ones for the choir, or breath) through three vowel formants; each syllable's
 *  consonant shapes the onset: a burst, a puff, a hum, a glide. A·TONE is the
 *  throat's size (formants up or down), B·DECAY how long notes are held. */
export class PocketSpeakDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly oRst = this.oi('rsto')
  private readonly P = {
    tempo: this.pi('tempo'), swing: this.pi('swing'), vol: this.pi('vol'), run: this.pi('run'), voice: this.pi('voice'),
    oct: this.pi('oct'), a: this.pi('a'), b: this.pi('b'), scale: this.pi('scale'), root: this.pi('root'),
  }
  private readonly song = new PocketSong((id) => this.pi(id), true)
  private readonly fx = new PocketFx(this.fs)
  private readonly clock: PocketClock
  private readonly formants = [new Formant(), new Formant(), new Formant()]
  private readonly burstF = new Svf()
  /** Formant frequencies now, and the vowel's (before the throat's size). */
  private readonly fNow = new Float64Array(3)
  private readonly fGoal = new Float64Array(3)
  private readonly ph = new Float64Array(3)
  private kind = OPEN
  private burstHz = 0
  private burst = 0
  /** Seconds since the syllable began (not `age`: the base class has one). */
  private sylT = 0
  private volts = 0
  private gate = 0
  private amp = 0
  private deg = 0
  private held = -1
  private flash = 0
  private readonly glide: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(PSTEPS, fs)
    this.glide = 1 - Math.exp(-1 / (0.025 * fs))
    for (let n = 0; n < 3; n++) this.fNow[n] = this.fGoal[n] = F[A][n]
  }

  private degVolts(degree: number): number {
    const steps = SCALE_STEPS[Math.round(this.p[this.P.scale])] ?? SCALE_STEPS[0]
    const d = Math.max(0, Math.round(degree))
    return (steps[d % steps.length] + 12 * Math.floor(d / steps.length) + this.p[this.P.root] + 12 * this.p[this.P.oct] - 12) / 12
  }

  private sing(degree: number, syllable: number, gateSec: number): void {
    const s = SYLLABLES[Math.max(0, Math.min(SYLLABLES.length - 1, syllable))]
    this.deg = degree
    this.volts = this.degVolts(degree)
    this.kind = s.kind
    this.burstHz = s.burst
    this.burst = s.kind === VOICED || s.kind === PUFF ? 1 : 0
    this.sylT = 0
    for (let n = 0; n < 3; n++) {
      this.fGoal[n] = F[s.vowel][n]
      if (s.start.length) this.fNow[n] = s.start[n]
    }
    this.gate = gateSec * this.fs
    this.flash = 1
  }

  onUi(ev: UiEvent): void {
    if (this.fx.onUi(ev) || ev.kind !== 'surface' || ev.name !== 'key') return
    if (ev.down) {
      this.held = Math.min(MELODY_NOTES + 1, Math.round(ev.x))
      this.sing(this.held, 0, 30)
    } else {
      this.held = -1
      this.gate = 0
    }
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const c = this.clock
    const stepped = c.tick(p[this.P.run] >= 0.5, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.P.tempo], p[this.P.swing], this.in[this.iRst])
    if (c.restarted) this.song.reset()
    if (stepped) {
      const s = c.step
      const sg = this.song
      if (s === 0) sg.bar(p)
      if (this.held < 0 && (p[sg.mask] & (1 << s)) !== 0) this.sing(p[sg.note + s], Math.round(p[sg.flag + s]), c.stepLen * (0.5 + p[this.P.b] * 1.4))
    }
    this.out[this.oRst] = c.rstSample()

    this.sylT += 1 / fs
    const on = this.gate > 0 || this.held >= 0
    if (this.gate > 0) this.gate--
    this.amp += ((on ? 1 : 0) - this.amp) * (on ? 0.003 : 0.0005)

    let y = 0
    if (this.amp > 1e-4) {
      const voice = Math.round(p[this.P.voice])
      // the source: glottal buzz (one, or a choir of three), or breath
      const f0 = C4 * Math.pow(2, this.volts + (this.sylT > 0.2 ? 0.003 * Math.sin(5.5 * 6.283 * this.sylT) : 0))
      let src = 0
      if (voice === WHISPER) src = (this.rng.next() * 2 - 1) * 1.5
      else {
        const n = voice === CHOIR ? 3 : 1
        for (let k = 0; k < n; k++) {
          const dt = (f0 * (1 + DETUNE[k])) / fs
          this.ph[k] = (this.ph[k] + dt) % 1
          src += (2 * this.ph[k] - 1 - polyBlep(this.ph[k], dt)) / Math.sqrt(n)
        }
        if (voice === CHOIR) src += (this.rng.next() * 2 - 1) * 0.08
      }
      // the consonant: a puff holds the voice back; a hum keeps the mouth shut
      const puffing = this.kind === PUFF && this.sylT < PUFF_S
      const humming = this.kind === NASAL && this.sylT < NASAL_S
      if (puffing) src *= 0.05
      if (!humming) for (let n = 0; n < 3; n++) this.fNow[n] += (this.fGoal[n] - this.fNow[n]) * this.glide
      const size = 0.75 + p[this.P.a] * 0.6
      for (let n = 0; n < 3; n++) {
        const g = Math.tan((Math.PI * Math.min(this.fNow[n] * size, fs * 0.45)) / fs)
        const k = 0.1 * (n + 1) * 0.7
        y += this.formants[n].run(src * 0.3, g, k) * k * GAINS[n] * (humming && n > 0 ? 0.1 : 1)
      }
      y *= humming ? 7 : 4
      // the burst of a stop: noise through a band-pass, gone in a few ms
      if (this.burst > 1e-3) {
        this.burstF.process(this.rng.next() * 2 - 1, this.burstHz, 0.7, fs)
        y += this.burstF.bp * this.burst * (this.kind === PUFF ? 0.6 : 0.4)
        this.burst *= Math.exp(-1 / ((this.kind === PUFF ? 0.025 : 0.008) * fs))
      }
      y *= this.amp
    }

    const o = this.out
    o[0] = this.fx.process(Math.tanh(y * 2.5) * 5 * p[this.P.vol], c.sixteenth)
    o[1] = c.clkSample()
    o[2] = this.volts
    o[3] = on ? 10 : 0
    this.flash *= 0.9995
    this.led[PSL.step] = c.step
    this.led[PSL.flash] = this.flash
    this.led[PSL.note] = this.deg
    this.song.leds(this.led, PSL.song, this.fx.held)
  }
}
