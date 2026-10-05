import type { ModuleSpec } from '../../modules/types'
import { PROGL } from '../../modules/specs/progression'
import { Dsp } from './base'
import { Schmitt } from './cores'

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
/** Minor with the harmonic-minor leading tone for V and vii°. */
const MINOR = [0, 2, 3, 5, 7, 8, 10]
/** Next-chord weights by scale degree (I ii iii IV V vi vii°). */
const NEXT: number[][] = [
  [0, 2, 0.5, 3, 3, 2.5, 0.3],
  [0.3, 0, 0, 0.5, 5, 0, 1],
  [0, 1, 0, 2, 0, 4, 0],
  [2, 2, 0, 0, 4, 0.5, 0.5],
  [6, 0, 0, 0.5, 0, 2, 0],
  [0, 3, 0.5, 3, 1, 0, 0],
  [5, 0, 1, 0, 0, 0, 0],
]
/** Tonic / pre-dominant / dominant, per degree. */
const FUNC = [0, 1, 0, 1, 2, 0, 2]
const VOICES = 4

/** Chord progression generator (see the spec). */
export class ProgressionDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iHome = this.ii('home')
  private readonly pKey = this.pi('key')
  private readonly pMode = this.pi('mode')
  private readonly pMood = this.pi('mood')
  private readonly pTempo = this.pi('tempo')
  private readonly pBars = this.pi('bars')
  private readonly oNotes = this.oi('notes')
  private readonly clk = new Schmitt()
  private readonly home = new Schmitt()
  private degree = 0
  private goHome = false
  private readonly voices = new Float64Array([-12, -5, 0, 4]) // semitones from C4
  private readonly pcs: number[] = []
  private rootSemi = 0
  private ph = 1
  private gate = 0
  private readonly history = new Float64Array(PROGL.count).fill(-1)

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.build(0, false, false)
  }

  /** Pitch classes (from the key) of scale degree d's chord. */
  private build(d: number, seventh: boolean, borrowed: boolean): void {
    const minor = this.p[this.pMode] >= 0.5
    const scale = minor || borrowed ? MINOR : MAJOR
    const key = Math.round(this.p[this.pKey])
    const at = (k: number) => {
      let s = scale[(d + k) % 7] + 12 * Math.floor((d + k) / 7)
      // harmonic minor: raise the 7th inside V and vii° (the leading tone)
      if ((minor || borrowed) && (d === 4 || d === 6) && (d + k) % 7 === 6) s += 1
      return s
    }
    const tones = [at(0), at(2), at(4)]
    if (seventh) tones.push(at(6))
    this.pcs.length = 0
    for (const t of tones) this.pcs.push((((t + key) % 12) + 12) % 12)
    this.rootSemi = ((at(0) + key) % 12) - 12
  }

  /** Move each voice to the nearest chord tone, every chord tone covered. */
  private voiceLead(): void {
    const used = new Set<number>()
    const order = [...this.voices.keys()].sort((a, b) => this.voices[a] - this.voices[b])
    for (const v of order) {
      const cur = this.voices[v]
      let best = cur
      let bestD = Infinity
      for (let n = cur - 7; n <= cur + 7; n++) {
        const pc = ((n % 12) + 12) % 12
        if (!this.pcs.includes(pc)) continue
        // prefer tones nobody has yet (until all are covered)
        const d = Math.abs(n - cur) + (used.has(pc) && used.size < this.pcs.length ? 4 : 0)
        if (d < bestD) {
          bestD = d
          best = n
        }
      }
      this.voices[v] = Math.max(-14, Math.min(19, best))
      used.add(((best % 12) + 12) % 12)
    }
  }

  private change(): void {
    const mood = this.p[this.pMood]
    let next = 0
    if (!this.goHome) {
      const w = NEXT[this.degree]
      let sum = 0
      for (const x of w) sum += x
      let r = this.rng.next() * sum
      for (next = 0; next < 7; next++) {
        r -= w[next]
        if (r <= 0) break
      }
      next = Math.min(6, next)
    }
    this.goHome = false
    const minorMode = this.p[this.pMode] >= 0.5
    const borrowed = !minorMode && (next === 3 || next === 5 || next === 6) && this.rng.next() < mood * 0.4
    const seventh = this.rng.next() < mood * 0.7
    this.degree = next
    this.build(next, seventh, borrowed)
    this.voiceLead()
    this.gate = Math.round(0.01 * this.fs)
    this.history.copyWithin(0, 1)
    this.history[PROGL.count - 1] = next + (seventh ? 8 : 0) + (borrowed ? 16 : 0)
  }

  tick(): void {
    const p = this.p
    if (this.home.rise(this.in[this.iHome])) this.goHome = true
    if (this.patched[this.iClk]) {
      if (this.clk.rise(this.in[this.iClk])) this.change()
    } else {
      this.ph += p[this.pTempo] / 60 / 4 / Math.round(p[this.pBars]) / this.fs
      if (this.ph >= 1) {
        this.ph -= 1
        this.change()
      }
    }
    for (let v = 0; v < VOICES; v++) this.pout(this.oNotes, v, this.voices[v] / 12)
    this.chans[this.oNotes] = VOICES
    const o = this.out
    o[1] = this.rootSemi / 12
    o[2] = this.gate > 0 ? 10 : 0
    o[3] = FUNC[this.degree] * 5
    if (this.gate > 0) this.gate--
    for (let i = 0; i < PROGL.count; i++) this.led[PROGL.history + i] = this.history[i]
  }
}
