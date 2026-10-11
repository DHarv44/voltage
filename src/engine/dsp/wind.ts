import type { MidiEvent } from '../protocol'
import { Biquad } from './biquad'
import { Dsp } from './base'
import { KeyboardCore } from './cores'
import { DelayLine } from './delayLine'
import { C4, TAU } from './util'

/** BREATH: digital waveguides after the classic physical models. FLUTE: the
 *  breath, less what the bore reflects, travels as a jet across the
 *  embouchure (a short delay) and is split by the edge (a cubic: the jet
 *  flips in and out), feeding the bore (a delay a period long, through a
 *  low-pass: the tube's losses). Blow harder and it jumps up an octave.
 *  CLARINET: a reed (pressure-controlled valve, a clipped line) at the end
 *  of a tube closed at one end (half the delay, a sign-flipping reflection):
 *  only odd harmonics, the hollow low register. */
export class WindDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iG = this.ii('gate')
  private readonly iB = this.ii('bcv')
  private readonly oOut = this.oi('out')
  private readonly P = Object.fromEntries(['model', 'breath', 'noise', 'tone', 'vib', 'att', 'rel', 'level'].map((id) => [id, this.pi(id)])) as Record<string, number>
  private readonly kb = new KeyboardCore()
  private readonly bore: DelayLine
  private readonly jet: DelayLine
  private env = 0
  private lp = 0
  private dcX = 0
  private dcY = 0
  private vibPh = 0
  private last = 0
  private noiseLp = 0
  /** The reflection's DC blocker (flute). */
  private rX = 0
  private rY = 0
  private readonly dcR: number

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.bore = new DelayLine(Math.ceil(this.fs / 20))
    this.jet = new DelayLine(Math.ceil(this.fs / 40))
    this.dcR = 1 - (TAU * 20) / this.fs
    this.hp1 = new Biquad(this.fs).highpass(110, 0.6)
    this.hp2 = new Biquad(this.fs).highpass(110, 0.6)
  }

  private readonly hp1: Biquad
  private readonly hp2: Biquad

  onMidi(ev: MidiEvent): void {
    this.kb.midi(ev, this.fs)
  }

  tick(): void {
    const p = this.p
    const P = this.P
    const fs = this.fs
    this.kb.step(0.03, fs)
    const cable = this.patched[this.iG] === 1
    const gate = cable ? this.in[this.iG] > 1 : this.kb.gate
    const v = cable || this.patched[this.iV] ? this.in[this.iV] + (cable ? 0 : this.kb.pitch) : this.kb.pitch
    // the player's breath: an envelope (or BREATH CV), with vibrato and air noise
    const t = gate ? p[P.att] : p[P.rel]
    this.env += ((gate ? 1 : 0) - this.env) * (1 - Math.exp(-1 / (t * 0.4 * fs)))
    const blow = this.patched[this.iB] ? Math.max(0, Math.min(1.2, this.in[this.iB] / 10)) : this.env
    this.vibPh = (this.vibPh + 5.2 / fs) % 1
    const vib = Math.sin(TAU * this.vibPh) * p[P.vib] * 0.08 * Math.min(1, this.env * 1.5)
    this.noiseLp += ((this.rng.next() * 2 - 1) - this.noiseLp) * 0.3
    const breath = blow * (p[P.breath] * (1 + vib)) + this.noiseLp * p[P.noise] * 0.12 * blow
    const hz = C4 * Math.pow(2, v)
    const clar = p[P.model] >= 0.5
    // the tube's losses: brighter TONE, less damping
    const k = 0.25 + p[P.tone] * 0.7
    let y: number
    if (!clar) {
      // the bore is tuned for the note blown in its second mode (the flute's normal register)
      const len = Math.max(2, fs / (hz * 0.66666) - 2)
      const boreOut = this.bore.tapLin(len)
      // the losses at the open end: an inverting one-pole low-pass, then DC blocked
      const pole = 0.78 - p[P.tone] * 0.3
      this.lp = -(1 - pole) * boreOut + pole * this.lp
      this.rY = this.lp - this.rX + this.dcR * this.rY
      this.rX = this.lp
      const refl = this.rY
      // a flute needs a firm breath to speak (pressure about 1.1–1.3)
      this.jet.write(breath * 1.75 - 0.5 * refl)
      let j = this.jet.tapLin(len * 0.32)
      j = j * (j * j - 1)
      j = j > 1 ? 1 : j < -1 ? -1 : j
      this.bore.write(j + 0.5 * refl)
      y = boreOut * 0.9
    } else {
      const len = Math.max(2, fs / hz / 2 - 1)
      const boreOut = this.bore.tapLin(len)
      this.lp += (boreOut - this.lp) * k
      const diff = -0.95 * this.lp - breath
      let reed = 0.7 - 0.3 * diff
      reed = reed > 1 ? 1 : reed < -1 ? -1 : reed
      this.bore.write(breath + diff * reed)
      y = boreOut * 0.9
    }
    this.dcY = y - this.dcX + this.dcR * this.dcY
    this.dcX = y
    // nothing a wind instrument makes lives below its lowest notes: the breath's thump goes
    this.last = this.hp2.run(this.hp1.run(this.dcY))
    this.out[this.oOut] = Math.max(-8, Math.min(8, this.last * 3.2 * p[P.level]))
  }
}
