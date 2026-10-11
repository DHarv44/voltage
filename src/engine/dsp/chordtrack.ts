import type { ModuleSpec } from '../../modules/types'
import { CT_BARS, CTL } from '../../modules/specs/chordtrack'
import { QUALITIES } from '../../modules/specs/combo/chords'
import { Dsp } from './base'
import { PocketClock } from './pocketClock'

const STEPS_PER_BAR = 16
const RETRIG_S = 0.003
const TRIG_S = 0.005
/** The close voicing sits in the octave from G3 up (MIDI). */
const LOW = 55

/** CHORD TRACK: steps through BARS × 16 sixteenths; on each bar (and half
 *  bar, if it has a change) the chord written there sounds, voiced inside an
 *  octave window (so each voice moves as little as it can), DROP 2 or OPEN
 *  spreading it; every change re-gates the voices. */
export class ChordTrackDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iTrans = this.ii('trans')
  private readonly oNotes = this.oi('notes')
  private readonly oGate = this.oi('gate')
  private readonly oRoot = this.oi('root')
  private readonly oChg = this.oi('chg')
  private readonly pTempo = this.pi('tempo')
  private readonly pBars = this.pi('bars')
  private readonly pOct = this.pi('oct')
  private readonly pVoicing = this.pi('voicing')
  private readonly pRun = this.pi('run')
  private readonly pC0 = this.pi('c0')
  private readonly clock: PocketClock
  private step = -1
  private chord = -1
  private shift = 0
  private readonly notes = new Int32Array(4)
  private count = 0
  private gap = 0
  private chg = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(STEPS_PER_BAR * CT_BARS, fs)
  }

  /** The chord sounding at the start of bar b: the last one written before
   *  it (a half-bar change counts), going round the loop. */
  private chordAt(b: number, bars: number): number {
    for (let i = 0; i < bars; i++) {
      const k = (b - i + bars) % bars
      const h = i > 0 ? Math.round(this.p[this.pC0 + k * 2 + 1]) : 0
      if (h > 0) return h - 1
      const c = Math.round(this.p[this.pC0 + k * 2])
      if (c > 0) return c - 1
    }
    return -1
  }

  private play(code: number): void {
    const q = QUALITIES[code % 16] ?? QUALITIES[0]
    const root = (Math.floor(code / 16) + this.shift + 120) % 12
    const n = q.tones.length
    // each tone in the window G3..F#4, then sorted: a close voicing
    for (let i = 0; i < n; i++) {
      const pc = (root + q.tones[i]) % 12
      this.notes[i] = LOW + ((pc - (LOW % 12) + 12) % 12)
    }
    for (let i = 1; i < n; i++)
      for (let j = i; j > 0 && this.notes[j] < this.notes[j - 1]; j--) {
        const t = this.notes[j]
        this.notes[j] = this.notes[j - 1]
        this.notes[j - 1] = t
      }
    const v = Math.round(this.p[this.pVoicing])
    if (v === 1 && n >= 3) this.notes[n - 2] -= 12 // drop 2: the second from the top down an octave
    if (v === 2 && n >= 3) {
      this.notes[1] -= 12 // open: the middle voices spread down
      if (n === 4) this.notes[2] += 12
    }
    this.count = n
    this.chord = code
    this.gap = Math.round(RETRIG_S * this.fs)
    this.chg = Math.round(TRIG_S * this.fs)
  }

  private advance(): void {
    const bars = Math.max(1, Math.min(CT_BARS, Math.round(this.p[this.pBars])))
    this.step = (this.step + 1) % (bars * STEPS_PER_BAR)
    const b = Math.floor(this.step / STEPS_PER_BAR)
    const s = this.step % STEPS_PER_BAR
    if (s === 0) {
      // a written chord plays; a held bar keeps what's sounding (or finds it, after a stop)
      const written = Math.round(this.p[this.pC0 + b * 2])
      if (written > 0) this.play(written - 1)
      else if (this.count === 0) {
        const c = this.chordAt(b, bars)
        if (c >= 0) this.play(c)
      }
    } else if (s === STEPS_PER_BAR / 2) {
      const h = Math.round(this.p[this.pC0 + b * 2 + 1])
      if (h > 0) this.play(h - 1)
    }
  }

  tick(): void {
    const p = this.p
    const running = p[this.pRun] >= 0.5
    const c = this.clock
    const stepped = c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.pTempo], 0, this.in[this.iRst])
    // stopped or starting over: silent until the next chord; a stopped CLK lets go too
    if (c.restarted || !running) {
      this.step = -1
      this.chord = -1
      this.count = 0
    } else if (c.stalled(this.patched[this.iClk] === 1)) this.count = 0
    // KEY: a new transpose re-voices the chord at once
    const shift = Math.round(this.in[this.iTrans] * 12)
    if (shift !== this.shift) {
      this.shift = shift
      if (this.chord >= 0 && this.count > 0) this.play(this.chord)
    }
    if (stepped) this.advance()
    const oct = Math.round(p[this.pOct])
    const n = this.count
    for (let v = 0; v < n; v++) {
      this.pout(this.oNotes, v, (this.notes[v] - 60) / 12 + oct)
      this.pout(this.oGate, v, this.gap > 0 ? 0 : 10)
    }
    this.chans[this.oNotes] = Math.max(1, n)
    this.chans[this.oGate] = Math.max(1, n)
    if (n === 0) {
      this.pout(this.oNotes, 0, 0)
      this.pout(this.oGate, 0, 0)
    }
    const root = this.chord >= 0 ? (Math.floor(this.chord / 16) + this.shift + 120) % 12 : 0
    this.out[this.oRoot] = (36 + root - 60) / 12 + oct
    this.out[this.oChg] = this.chg > 0 ? 10 : 0
    if (this.gap > 0) this.gap--
    if (this.chg > 0) this.chg--
    this.led[CTL.bar] = this.step < 0 || n === 0 ? -1 : Math.floor(this.step / STEPS_PER_BAR)
    this.led[CTL.half] = this.step % STEPS_PER_BAR >= STEPS_PER_BAR / 2 ? 1 : 0
    this.led[CTL.chord] = n > 0 ? this.chord : -1
  }
}
