import type { ModuleSpec } from '../../modules/types'
import { KALEIDO_MODELS } from '../../modules/specs/macroVoices'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { KsString } from './kstring'
import { Mode } from './modal'
import { F, Formant, GAINS } from './talkbox'
import { C4, polyBlep, TAU } from './util'

const FOLD = 1
const FM = 2
const VOWEL = 3
const ADDITIVE = 4
const CHORD = 5
const STRING = 6
const MODAL = 7
const LAST = KALEIDO_MODELS.length - 1
/** VA: HARMONICS past the detune zone steps through these intervals. */
const INTERVALS = [3, 4, 5, 7, 12, 19, 24]
const FM_RATIOS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7]
const CHORDS = [
  [0, 12, 19, 24],
  [0, 7, 12, 19],
  [0, 5, 7, 12],
  [0, 3, 7, 12],
  [0, 3, 7, 10],
  [0, 4, 7, 12],
  [0, 4, 7, 11],
  [0, 2, 4, 7],
]
const PARTIALS = 12
const MODES = 10

/** Triangle folding: a wave pushed past ±1 folds back on itself. */
const fold = (x: number) => {
  const y = (x + 1) * 0.25
  return 1 - 4 * Math.abs(y - Math.floor(y) - 0.5)
}

/** KALEIDO: a macro oscillator. Each MODEL is a different way of making a
 *  sound (see KALEIDO_KNOBS for its three knobs); TRIG patched plays each
 *  note through a vactrol-style low-pass gate, except STRING and MODAL,
 *  which are struck (by TRIG, or by each new note at V/OCT when it's empty). */
export class KaleidoDsp extends Dsp {
  private readonly iVoct = this.ii('voct')
  private readonly iTrig = this.ii('trig')
  private readonly iModel = this.ii('model')
  private readonly iHarm = this.ii('harm')
  private readonly iTimbre = this.ii('timbre')
  private readonly iMorph = this.ii('morph')
  private readonly pModel = this.pi('model')
  private readonly pTune = this.pi('tune')
  private readonly pHarm = this.pi('harm')
  private readonly pTimbre = this.pi('timbre')
  private readonly pMorph = this.pi('morph')
  private readonly pDecay = this.pi('decay')
  private readonly trig = new Schmitt()
  private readonly ph = new Float64Array(4)
  private modPh = 0
  private fbPrev = 0
  private readonly formants = [new Formant(), new Formant(), new Formant()]
  private readonly string: KsString
  private readonly modes = Array.from({ length: MODES }, () => new Mode())
  private lpg = 0
  private lpgLp = 0
  private auxLp = 0
  private struckV = Number.NaN

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.string = new KsString(fs / 20, seed)
  }

  private cv(pi: number, ii: number): number {
    const v = this.p[pi] + this.in[ii] / 10
    return v < 0 ? 0 : v > 1 ? 1 : v
  }

  private strike(model: number, f: number, h: number, t: number, m: number): void {
    if (model === STRING) {
      this.string.tune(f, this.fs, 0.2 + m * m * 8, t)
      this.string.pluck(1, t, 0.03 + h * 0.47)
      return
    }
    const stiff = h * h * 0.08
    for (let k = 0; k < MODES; k++) {
      const n = k + 1
      this.modes[k].tune(f * n * Math.sqrt(1 + stiff * n * n), (0.15 + m * m * 6) / (1 + k * 0.4 * (1 - t)), this.fs)
      this.modes[k].strike((k === 0 ? 1 : Math.pow(t, k * 0.5)) / Math.sqrt(n))
    }
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const h = this.cv(this.pHarm, this.iHarm)
    const t = this.cv(this.pTimbre, this.iTimbre)
    const m = this.cv(this.pMorph, this.iMorph)
    const pm = Math.round(p[this.pModel] + (this.patched[this.iModel] ? this.in[this.iModel] * 0.8 : 0))
    const model = pm < 0 ? 0 : pm > LAST ? LAST : pm
    const v = this.in[this.iVoct] + p[this.pTune] / 12
    const f = C4 * Math.pow(2, v)
    const dt = f / fs
    const trigged = this.patched[this.iTrig] === 1
    const hit = this.trig.rise(this.in[this.iTrig])
    const struck = model === STRING || model === MODAL
    if (struck && (hit || (!trigged && !(Math.abs(v - this.struckV) < 0.02)))) {
      this.struckV = v
      this.strike(model, f, h, t, m)
    }
    const ph = this.ph
    ph[0] = (ph[0] + dt) % 1
    let main = 0
    let aux = 0
    if (model === 0) {
      // VA: a saw against a second oscillator detuned (or a set interval) away
      const semis = h < 0.2 ? h * 1.5 : INTERVALS[Math.min(INTERVALS.length - 1, Math.floor(((h - 0.2) / 0.8) * INTERVALS.length))]
      const dt2 = dt * Math.pow(2, semis / 12)
      ph[1] = (ph[1] + dt2) % 1
      ph[2] = (ph[2] + dt * 0.5) % 1
      const w = 0.5 - t * 0.45
      const sq = (ph[1] < w ? 1 : -1) + polyBlep(ph[1], dt2) - polyBlep((ph[1] - w + 1) % 1, dt2)
      const saw2 = 2 * ph[1] - 1 - polyBlep(ph[1], dt2)
      main = (2 * ph[0] - 1 - polyBlep(ph[0], dt) + saw2 * (1 - m) + sq * m) * 0.4
      aux = ph[2] < 0.5 ? 0.5 : -0.5 // a sub an octave down
    } else if (model === FOLD) {
      const s = Math.sin(TAU * ph[0]) + h * 0.7 * Math.sin(2 * TAU * ph[0])
      main = fold((s * 0.8 + (m - 0.5) * 0.8) * (1 + t * 6)) * 0.8
      aux = Math.sin(TAU * ph[0]) * 0.8
    } else if (model === FM) {
      this.modPh = (this.modPh + dt * FM_RATIOS[Math.round(h * (FM_RATIOS.length - 1))]) % 1
      const mod = Math.sin(TAU * this.modPh + this.fbPrev * m * 1.5)
      this.fbPrev = mod
      main = Math.sin(TAU * ph[0] + mod * t * 6) * 0.8
      aux = mod * 0.8
    } else if (model === VOWEL) {
      const src = 2 * ph[0] - 1 - polyBlep(ph[0], dt) + (this.rng.next() * 2 - 1) * m
      const at = t * (F.length - 1)
      const a = Math.min(F.length - 2, Math.floor(at))
      const fr = at - a
      const shift = 0.7 + h * 0.7
      for (let k = 0; k < 3; k++) {
        const hz = (F[a][k] + (F[a + 1][k] - F[a][k]) * fr) * shift
        main += this.formants[k].run(src, Math.tan((Math.PI * Math.min(hz, fs * 0.45)) / fs), 0.12 + m * 0.2) * GAINS[k]
      }
      main *= 0.4
      aux = src * 0.4
    } else if (model === ADDITIVE) {
      // a bell curve of harmonics round HARMONICS, as wide as TIMBRE; MORPH tips odd to even
      const c = 1 + h * 10
      const wid = 0.4 + t * 5
      const odd = Math.min(1, 2 * (1 - m))
      const even = Math.min(1, 2 * m)
      let sum = 0
      let norm = 0
      // sin(nθ) by recurrence: one sin and one cos per sample, not twelve
      const s1 = Math.sin(TAU * ph[0])
      const c2 = 2 * Math.cos(TAU * ph[0])
      let prev = 0
      let cur = s1
      for (let n = 1; n <= PARTIALS && n * f < fs * 0.45; n++) {
        const d = (n - c) / wid
        const amp = Math.exp(-d * d) * (n % 2 === 1 ? odd : even)
        sum += amp * cur
        norm += amp
        const next = c2 * cur - prev
        prev = cur
        cur = next
      }
      main = norm > 0 ? (sum / Math.max(1, norm)) * 0.9 : 0
      aux = Math.sin(TAU * ph[0]) * 0.8
    } else if (model === CHORD) {
      const ch = CHORDS[Math.round(h * (CHORDS.length - 1))]
      const inv = Math.floor(t * 4.99) // voicing: the lowest notes go up an octave
      for (let j = 0; j < 4; j++) {
        const dj = dt * Math.pow(2, (ch[j] + (j < inv ? 12 : 0)) / 12)
        ph[j] = j === 0 ? ph[0] : (ph[j] + dj) % 1
        const saw = 2 * ph[j] - 1 - polyBlep(ph[j], dj)
        const organ = Math.sin(TAU * ph[j]) + 0.5 * Math.sin(2 * TAU * ph[j])
        const y = saw * (1 - m) + organ * m * 0.7
        main += y * 0.3
        if (j === 0) aux = y * 0.6
      }
    } else if (model === STRING) {
      main = this.string.step() * 0.55
      this.auxLp += (main - this.auxLp) * 0.05
      aux = this.auxLp * 2
    } else {
      for (let k = 0; k < MODES; k++) {
        const y = this.modes[k].step()
        main += y
        if (k === 0) aux = y
      }
      main *= 0.5
    }
    // the low-pass gate: each TRIG opens it, and it closes (and darkens) over DECAY
    if (trigged && !struck) {
      this.lpg = hit ? 1 : this.lpg * Math.exp(-1 / (p[this.pDecay] * fs))
      const fc = 200 + this.lpg * this.lpg * 16000
      this.lpgLp += (main * this.lpg - this.lpgLp) * Math.min(1, (TAU * fc) / fs)
      main = this.lpgLp
      aux *= this.lpg
    }
    this.out[0] = main * 5
    this.out[1] = aux * 5
  }
}
