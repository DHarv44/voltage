import { Dsp } from './base'
import { Schmitt } from './cores'
import { DRUM_CHANNEL, type MidiEvent } from '../protocol'
import { rails } from './util'

/** Sub-oscillator: comparator (with hysteresis) + two flip-flops, so the subs
 *  are squares at exactly −1 and −2 octaves, phase-locked to the input. */
export class SubDsp extends Dsp {
  private high = false
  private ff1 = false
  private ff2 = false
  private pLvl = this.pi('lvl')

  tick(): void {
    const x = this.in[0]
    const was = this.high
    this.high = was ? x > -0.1 : x > 0.1
    if (this.high && !was) {
      this.ff1 = !this.ff1
      if (this.ff1) this.ff2 = !this.ff2
    }
    const s1 = this.ff1 ? 5 : -5
    const s2 = this.ff2 ? 5 : -5
    this.out[0] = s1
    this.out[1] = s2
    this.out[2] = rails(x + s1 * this.p[this.pLvl])
  }
}

const MODES = 5

/** Arpeggiator. Holds the notes you play (MIDI/keys, not the drum channel),
 *  steps through them on each clock edge (CLK, or the internal RATE), across
 *  OCTAVES. Gate length is a fraction of the measured clock period. */
export class ArpDsp extends Dsp {
  private iClk = this.ii('clk')
  private iRst = this.ii('rst')
  private pMode = this.pi('mode')
  private pOct = this.pi('oct')
  private pRate = this.pi('rate')
  private pLen = this.pi('len')
  private pLatch = this.pi('latch')
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()

  private held: number[] = [] // in play order
  private latched: number[] = []
  private idx = -1
  private dir = 1
  private pitch = 0
  private gateLeft = 0
  private trig = 0
  private period: number
  private since = 0
  private phase = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.period = this.fs / 6
  }

  onMidi(ev: MidiEvent): void {
    if ((ev.kind === 'on' || ev.kind === 'off') && ev.ch === DRUM_CHANNEL) return
    if (ev.kind === 'on') {
      if (this.held.length === 0) this.latched = [] // a fresh chord replaces the latched one
      this.held = this.held.filter((n) => n !== ev.note).concat(ev.note)
      if (!this.latched.includes(ev.note)) this.latched.push(ev.note)
    } else if (ev.kind === 'off') this.held = this.held.filter((n) => n !== ev.note)
    else if (ev.kind === 'panic') {
      this.held = []
      this.latched = []
    }
  }

  /** The note list the current mode walks, expanded over octaves. */
  private sequence(): number[] {
    const base = this.p[this.pLatch] >= 0.5 ? this.latched : this.held
    if (!base.length) return []
    const mode = Math.round(this.p[this.pMode])
    const notes = mode === 4 ? base : [...base].sort((a, b) => a - b)
    const out: number[] = []
    for (let o = 0; o < Math.round(this.p[this.pOct]); o++) for (const n of notes) out.push(n + 12 * o)
    return out
  }

  private advance(): void {
    const seq = this.sequence()
    if (!seq.length) return
    const mode = Math.round(this.p[this.pMode]) % MODES
    const n = seq.length
    if (mode === 0 || mode === 4) this.idx = (this.idx + 1) % n
    else if (mode === 1) this.idx = this.idx <= 0 ? n - 1 : this.idx - 1
    else if (mode === 2) {
      if (n === 1) this.idx = 0
      else {
        let next = this.idx + this.dir
        if (next >= n || next < 0) {
          this.dir = -this.dir
          next = this.idx + this.dir
        }
        this.idx = Math.max(0, Math.min(n - 1, next))
      }
    } else this.idx = Math.floor(this.rng.next() * n)
    this.idx = Math.min(this.idx, n - 1)
    this.pitch = (seq[this.idx] - 60) / 12
    this.gateLeft = Math.max(1, Math.round(this.period * this.p[this.pLen]))
    this.trig = Math.round(0.002 * this.fs)
  }

  tick(): void {
    const i = this.in
    if (this.rst.rise(i[this.iRst])) {
      this.idx = -1
      this.dir = 1
    }
    this.since++
    let edge: boolean
    if (this.patched[this.iClk]) edge = this.clk.rise(i[this.iClk])
    else {
      this.phase += this.p[this.pRate] / this.fs
      edge = this.phase >= 1
      if (edge) this.phase -= 1
    }
    if (edge) {
      if (this.since > 8) this.period = this.since
      this.since = 0
      this.advance()
    }
    const o = this.out
    o[0] = this.pitch
    o[1] = this.gateLeft > 0 ? 10 : 0
    o[2] = this.trig > 0 ? 10 : 0
    if (this.gateLeft > 0) this.gateLeft--
    if (this.trig > 0) this.trig--
    this.led[0] = this.gateLeft > 0 ? 1 : 0
  }
}

/** Semitone stacks per chord quality (4 voices; triads double the root an octave up). */
const QUALITIES = [
  [0, 4, 7, 12],
  [0, 3, 7, 12],
  [0, 2, 7, 12],
  [0, 5, 7, 12],
  [0, 4, 7, 11],
  [0, 3, 7, 10],
  [0, 4, 7, 10],
  [0, 3, 6, 9],
]

/** Chord generator: four 1V/oct voices from one root. INVERSION lifts the
 *  lowest voices an octave; OPEN voicing drops the 2nd voice an octave
 *  (drop-2), spreading the chord like a pianist's left hand. */
export class ChordDsp extends Dsp {
  private iRoot = this.ii('root')
  private iQcv = this.ii('qcv')
  private pQual = this.pi('qual')
  private pInv = this.pi('inv')
  private pSpread = this.pi('spread')
  private readonly v = new Float64Array(4)

  tick(): void {
    const p = this.p
    const q = Math.max(0, Math.min(QUALITIES.length - 1, Math.round(p[this.pQual] + (this.in[this.iQcv] / 10) * 7)))
    const stack = QUALITIES[q]
    const inv = Math.round(p[this.pInv])
    const v = this.v
    for (let k = 0; k < 4; k++) v[k] = stack[k] + (k < inv ? 12 : 0)
    if (p[this.pSpread] >= 0.5) v[1] -= 12
    const root = this.in[this.iRoot]
    for (let k = 0; k < 4; k++) this.out[k] = root + v[k] / 12
  }
}
