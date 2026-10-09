import type { ModuleSpec } from '../../modules/types'
import { RESO_CHORDS, RESO_MODELS, RESO_POLY } from '../../modules/specs/macroVoices'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { KsString } from './kstring'
import { Mode } from './modal'
import { C4 } from './util'

const VOICES = 4
const MODES = 24
const STRINGS_PER = 4
const MODAL = 0
const STRINGS = 1
/** Retune the voice that's sounding every this many samples (knobs and V/OCT move). */
const RETUNE = 32

/** RESONATOR: something to ring, at the note on V/OCT. MODAL is 24 modes
 *  whose spacing STRUCTURE bends from a string's (harmonic) through a stiff
 *  string's to a bar's or bell's; STRINGS is four strings tuned to a chord
 *  (STRUCTURE picks it) ringing in sympathy; STRING is one plucked string.
 *  IN drives the voice that's sounding; with IN empty each STRUM strikes it.
 *  Without STRUM, an onset at IN (or, with IN empty too, a new note) strums.
 *  POLY: each strum moves to the next voice and the last keeps ringing. */
export class ResonatorDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iStrum = this.ii('strum')
  private readonly iVoct = this.ii('voct')
  private readonly iStruct = this.ii('structure')
  private readonly iBright = this.ii('bright')
  private readonly iDamp = this.ii('damp')
  private readonly iPos = this.ii('pos')
  private readonly pModel = this.pi('model')
  private readonly pPoly = this.pi('poly')
  private readonly pTune = this.pi('tune')
  private readonly pStruct = this.pi('structure')
  private readonly pBright = this.pi('bright')
  private readonly pDamp = this.pi('damp')
  private readonly pPos = this.pi('pos')
  private readonly modes = Array.from({ length: VOICES * MODES }, () => new Mode())
  /** Each mode's share of the excitation (position, brightness, under Nyquist). */
  private readonly gain = new Float32Array(VOICES * MODES)
  private readonly strings: KsString[]
  private readonly pitch = new Float64Array(VOICES)
  private readonly strum = new Schmitt()
  private voice = 0
  private n = 0
  private lastV = Number.NaN
  private fast = 0
  private slow = 0
  private holdoff = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.strings = Array.from({ length: VOICES * STRINGS_PER }, (_, k) => new KsString(fs / 20, seed + k * 7919))
  }

  private cv(pi: number, ii: number): number {
    const v = this.p[pi] + this.in[ii] / 10
    return v < 0 ? 0 : v > 1 ? 1 : v
  }

  /** Tune voice u's modes or strings to its pitch and the knobs. */
  private retune(u: number, model: number, s: number, b: number, d: number, pos: number): void {
    const fs = this.fs
    const f = C4 * Math.pow(2, this.pitch[u])
    if (model === MODAL) {
      const base = 0.15 + (1 - d) * (1 - d) * 8
      const stiff = s < 0.5 ? s * s * 0.08 : 0.02
      const bar = s < 0.5 ? 0 : (s - 0.5) * 2
      const at = 0.05 + pos * 0.45
      for (let k = 0; k < MODES; k++) {
        const n = k + 1
        const ratio = n * Math.sqrt(1 + stiff * n * n) * (1 - bar) + (((2 * n + 1) * (2 * n + 1)) / 9) * bar
        const hz = f * ratio
        this.modes[u * MODES + k].tune(hz, base / (1 + k * (1 - b) * 0.5), fs)
        this.gain[u * MODES + k] = hz > fs * 0.45 ? 0 : (0.25 + 0.75 * Math.abs(Math.sin(Math.PI * n * at))) * Math.pow(n, -(1 - b) * 1.5)
      }
    } else {
      const chord = RESO_CHORDS[Math.round(s * (RESO_CHORDS.length - 1))]
      const decay = 0.3 + (1 - d) * (1 - d) * 10
      const count = model === STRINGS ? STRINGS_PER : 1
      for (let j = 0; j < count; j++) this.strings[u * STRINGS_PER + j].tune(f * Math.pow(2, chord[j] / 12), fs, decay, b)
    }
  }

  /** Strike voice u from inside (nothing at IN to ring it). */
  private excite(u: number, model: number, b: number, pos: number): void {
    if (model === MODAL) for (let k = 0; k < MODES; k++) this.modes[u * MODES + k].strike(this.gain[u * MODES + k])
    else {
      const count = model === STRINGS ? STRINGS_PER : 1
      for (let j = 0; j < count; j++) this.strings[u * STRINGS_PER + j].pluck(model === STRINGS ? 0.6 : 1, b, 0.05 + pos * 0.45)
    }
  }

  tick(): void {
    const p = this.p
    const model = Math.max(0, Math.min(RESO_MODELS.length - 1, Math.round(p[this.pModel])))
    const poly = RESO_POLY[Math.max(0, Math.min(RESO_POLY.length - 1, Math.round(p[this.pPoly])))]
    const s = this.cv(this.pStruct, this.iStruct)
    const b = this.cv(this.pBright, this.iBright)
    const d = this.cv(this.pDamp, this.iDamp)
    const pos = this.cv(this.pPos, this.iPos)
    const v = this.in[this.iVoct] + p[this.pTune] / 12
    const fed = this.patched[this.iIn] === 1
    const x = fed ? this.in[this.iIn] : 0
    // what counts as a strum: STRUM, else an onset at IN, else a new note
    let hit: boolean
    if (this.patched[this.iStrum]) hit = this.strum.rise(this.in[this.iStrum])
    else if (fed) {
      const a = Math.abs(x)
      this.fast += (a - this.fast) * 0.01
      this.slow += (a - this.slow) * 0.0005
      if (this.holdoff > 0) this.holdoff--
      hit = this.holdoff === 0 && this.fast > this.slow * 2 + 0.2
      if (hit) this.holdoff = Math.round(0.05 * this.fs)
    } else hit = !(Math.abs(v - this.lastV) < 0.02)
    if (hit) {
      this.lastV = v
      this.voice = (this.voice + 1) % poly
      this.pitch[this.voice] = v
      this.retune(this.voice, model, s, b, d, pos)
      if (!fed) this.excite(this.voice, model, b, pos)
    }
    if (this.voice >= poly) this.voice = 0
    // the sounding voice follows V/OCT and the knobs
    if (++this.n >= RETUNE) {
      this.n = 0
      this.pitch[this.voice] = v
      this.retune(this.voice, model, s, b, d, pos)
    }

    let odd = 0
    let even = 0
    for (let u = 0; u < poly; u++) {
      const drive = u === this.voice ? x : 0
      if (model === MODAL) {
        for (let k = 0; k < MODES; k++) {
          const i = u * MODES + k
          const mo = this.modes[i]
          if (drive !== 0) mo.drive(drive * this.gain[i] * 0.02)
          const y = mo.step()
          if (k % 2 === 0) odd += y
          else even += y
        }
      } else {
        const count = model === STRINGS ? STRINGS_PER : 1
        for (let j = 0; j < count; j++) {
          const st = this.strings[u * STRINGS_PER + j]
          const y = st.step(drive * 0.05)
          // one string per voice: voices alternate sides (a single voice is in both)
          const left = model === STRINGS ? j % 2 === 0 : poly === 1 || u % 2 === 0
          if (left || (model !== STRINGS && poly === 1)) odd += y
          if (!left || (model !== STRINGS && poly === 1)) even += y
        }
      }
    }
    const g = model === MODAL ? 1.2 : model === STRINGS ? 4 : 3
    this.out[0] = Math.tanh(odd * g * 0.3) * 5
    this.out[1] = Math.tanh(even * g * 0.3) * 5
  }
}
