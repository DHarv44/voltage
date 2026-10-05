import { GHOSTL } from '../../modules/specs/ghost'
import { DRUM_CHANNEL, type MidiEvent } from '../protocol'
import { Dsp } from './base'

/** Intervals tracked: −12..+12 semitones (bigger leaps fold into an octave). */
const SPAN = 12
const STATES = SPAN * 2 + 1
const DURS = 32
const LISTEN = 0
const WAITING = 1
const ANSWERING = 2

/** What GHOST knows: a first-order Markov chain over melodic intervals, the
 *  pitch classes you favour, and your recent note and gap lengths. Counts
 *  decay by MEMORY on every new note so old habits fade. */
class Style {
  readonly trans = new Float64Array(STATES * STATES)
  readonly pcs = new Float64Array(12)
  readonly durs = new Float64Array(DURS)
  readonly gaps = new Float64Array(DURS)
  n = 0
  /** prevInt = NaN: the first note (no interval to learn yet, just the pitch). */
  learn(prevInt: number, int: number, note: number, dur: number, gap: number, memory: number): void {
    for (let i = 0; i < this.trans.length; i++) this.trans[i] *= memory
    for (let i = 0; i < 12; i++) this.pcs[i] *= memory
    if (!Number.isNaN(prevInt)) this.trans[(prevInt + SPAN) * STATES + int + SPAN] += 1
    this.pcs[((note % 12) + 12) % 12] += 1
    this.durs[this.n % DURS] = dur
    this.gaps[this.n % DURS] = gap
    this.n++
  }
}

const fold = (d: number) => {
  while (d > SPAN) d -= 12
  while (d < -SPAN) d += 12
  return d
}

export class GhostDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly pWait = this.pi('wait')
  private readonly pLength = this.pi('length')
  private readonly pTemper = this.pi('temper')
  private readonly pMemory = this.pi('memory')
  private readonly style = new Style()
  private state = LISTEN
  private t = 0
  // your playing
  private youOn = false
  private youNote = 0
  private youStart = 0
  private youEnd = 0
  private lastNote: number | null = null
  private lastInt = 0
  /** The middle of the register you play in. */
  private centre = 0
  /** Held MIDI key in semitones from C4 (NaN = none). */
  private midiNote = NaN
  // the answer
  private phrase = new Float64Array(16 * 3) // note, dur, gap
  private len = 0
  private idx = 0
  private nextAt = 0
  private offAt = 0
  private outNote = 0
  private outGate = false
  private turn = 0

  onMidi(ev: MidiEvent): void {
    if (ev.kind === 'on' && ev.ch !== DRUM_CHANNEL) this.midiNote = ev.note - 60
    else if (ev.kind === 'off' && ev.ch !== DRUM_CHANNEL && ev.note - 60 === this.midiNote) this.midiNote = NaN
  }

  private noteOn(note: number): void {
    // you play: GHOST stops and listens (no talking over you)
    this.state = LISTEN
    this.outGate = false
    const gap = this.youEnd ? this.t - this.youEnd : 0.25
    if (this.lastNote !== null) {
      const int = fold(note - this.lastNote)
      this.style.learn(this.lastInt, int, note, Math.max(0.05, this.youEnd - this.youStart), Math.min(2, gap), this.p[this.pMemory])
      this.lastInt = int
    } else this.style.learn(NaN, 0, note, 0.25, 0.1, this.p[this.pMemory])
    this.centre += (note - this.centre) * (this.style.n > 1 ? 0.15 : 1)
    this.youOn = true
    this.youNote = note
    this.youStart = this.t
    this.lastNote = note
  }

  private noteOff(): void {
    this.youOn = false
    this.youEnd = this.t
    this.state = WAITING
  }

  /** Weighted choice. TEMPER flattens what was learned and adds a little of
   *  anything (0 = your habits, 1 = adventurous). */
  private pick(weights: Float64Array, offset: number, count: number, temper: number): number {
    const w = (i: number) => (weights[offset + i] > 0 ? Math.pow(weights[offset + i], 1 - temper * 0.7) : 0) + temper * 0.03
    let sum = 0
    for (let i = 0; i < count; i++) sum += w(i)
    let r = this.rng.next() * sum
    for (let i = 0; i < count; i++) {
      r -= w(i)
      if (r <= 0) return i
    }
    return count - 1
  }

  /** Row of the interval chain for the previous interval, or (if that was
   *  never followed by anything) the overall interval habits. */
  private row(prev: number): Float64Array {
    const t = this.style.trans
    const off = (prev + SPAN) * STATES
    let sum = 0
    for (let i = 0; i < STATES; i++) sum += t[off + i]
    if (sum > 0.05) return t.subarray(off, off + STATES)
    const all = this.overall
    all.fill(0)
    for (let r = 0; r < STATES; r++) for (let i = 0; i < STATES; i++) all[i] += t[r * STATES + i]
    return all
  }

  private readonly overall = new Float64Array(STATES)

  /** Compose the answer: walk the interval chain from your last note, keep to
   *  your pitch classes, borrow your note and gap lengths. */
  private compose(): void {
    const s = this.style
    const temper = this.p[this.pTemper]
    const n = Math.round(this.p[this.pLength])
    let note = this.lastNote ?? 0
    let prev = this.lastInt
    for (let k = 0; k < n; k++) {
      let int = this.pick(this.row(prev), 0, STATES, temper) - SPAN
      // stay in your register: wandering too far, re-pick toward home (a few tries)
      for (let tries = 0; tries < 3 && Math.abs(note + int - this.centre) > 7 && Math.abs(note + int - this.centre) > Math.abs(note - this.centre); tries++)
        int = this.pick(this.row(prev), 0, STATES, temper) - SPAN
      // stay in your key: only a note you never use gets moved to the nearest one you do
      let cand = note + int
      let maxPc = 0
      for (let i = 0; i < 12; i++) maxPc = Math.max(maxPc, s.pcs[i])
      const yours = (n: number) => s.pcs[((n % 12) + 12) % 12] >= maxPc * 0.15
      if (!yours(cand)) for (const d of [1, -1, 2, -2]) if (yours(cand + d)) {
        cand += d
        break
      }
      cand = Math.max(-24, Math.min(24, cand))
      int = cand - note
      note = cand
      prev = fold(int)
      const memoryN = Math.min(DURS, s.n) || 1
      const pickD = Math.floor(this.rng.next() * memoryN)
      this.phrase[k * 3] = note
      this.phrase[k * 3 + 1] = Math.max(0.05, s.durs[pickD] || 0.2)
      this.phrase[k * 3 + 2] = Math.max(0.02, s.gaps[pickD] || 0.1)
    }
    this.len = n
    this.idx = 0
    this.nextAt = this.t
  }

  tick(): void {
    const dt = 1 / this.fs
    this.t += dt
    // Your notes: MIDI keys, or the rack's V/OCT + GATE.
    const cv = this.patched[this.iGate] ? this.in[this.iGate] > 1 : false
    const on = cv || !Number.isNaN(this.midiNote)
    const note = cv ? Math.round(this.in[this.iV] * 12) : this.midiNote
    if (on && (!this.youOn || note !== this.youNote)) this.noteOn(note)
    else if (!on && this.youOn) this.noteOff()

    if (this.state === WAITING && this.style.n > 1 && this.t - this.youEnd > this.p[this.pWait]) {
      this.compose()
      this.state = ANSWERING
      this.turn = Math.round(0.01 * this.fs)
    }
    if (this.state === ANSWERING) {
      if (this.outGate && this.t >= this.offAt) this.outGate = false
      if (!this.outGate && this.t >= this.nextAt) {
        if (this.idx >= this.len) this.state = LISTEN
        else {
          const k = this.idx++ * 3
          this.outNote = this.phrase[k]
          this.outGate = true
          this.offAt = this.t + this.phrase[k + 1]
          this.nextAt = this.offAt + this.phrase[k + 2]
        }
      }
    }
    const o = this.out
    o[0] = this.outNote / 12
    o[1] = this.outGate ? 10 : 0
    o[2] = this.turn > 0 ? 10 : 0
    if (this.turn > 0) this.turn--
    this.led[GHOSTL.you] = this.youOn ? this.youNote : -99
    this.led[GHOSTL.ghost] = this.outGate ? this.outNote : -99
    this.led[GHOSTL.state] = this.state
  }
}
