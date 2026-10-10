import type { ModuleSpec } from '../../modules/types'
import { pedalAt, PR_SLOTS, PR_STEPS_PER_BAR, PRL } from '../../modules/specs/pianoroll'
import { Dsp, MAX_VOICES } from './base'
import { PocketClock } from './pocketClock'

/** A gap before a voice plays again, so envelopes hear a new note (s). */
const RETRIG_S = 0.002

/** PIANO ROLL: steps through BARS × 16 sixteenths (its own tempo with
 *  swing, or one per CLK edge); on each step, notes that end let go and notes
 *  that start take a free voice (or the one nearest its end). Each voice is a
 *  channel of the poly PITCH / GATE / VEL cables. */
export class PianoRollDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iTrans = this.ii('trans')
  private readonly oPitch = this.oi('pitch')
  private readonly oGate = this.oi('gate')
  private readonly oVel = this.oi('vel')
  private readonly oEol = this.oi('eol')
  private readonly oPed = this.oi('ped')
  private readonly pP0 = this.pi('p0')
  private readonly pTempo = this.pi('tempo')
  private readonly pBars = this.pi('bars')
  private readonly pOct = this.pi('oct')
  private readonly pVoices = this.pi('voices')
  private readonly pSwing = this.pi('swing')
  private readonly pRun = this.pi('run')
  private readonly pS0 = this.pi('s0')
  private readonly clock: PocketClock
  private step = -1
  /** Per voice: its note, steps left to sound, velocity, a retrigger gap. */
  private readonly note = new Int32Array(MAX_VOICES).fill(-1)
  private readonly left = new Int32Array(MAX_VOICES)
  private readonly vel = new Float64Array(MAX_VOICES)
  private readonly gap = new Int32Array(MAX_VOICES)
  private eol = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.clock = new PocketClock(PR_STEPS_PER_BAR * 4, fs)
  }

  private release(): void {
    this.note.fill(-1)
    this.left.fill(0)
  }

  private advance(voices: number): void {
    const p = this.p
    const len = Math.max(1, Math.round(p[this.pBars])) * PR_STEPS_PER_BAR
    this.step = (this.step + 1) % len
    if (this.step === 0) this.eol = Math.round(0.005 * this.fs)
    // notes that have run their length let go
    for (let v = 0; v < MAX_VOICES; v++) if (this.left[v] > 0 && --this.left[v] === 0) this.note[v] = -1
    if (this.step === 0) this.release() // nothing hangs over the loop
    // notes starting now take a voice: a free one, else the one nearest its end
    for (let i = 0; i < PR_SLOTS; i++) {
      const b = this.pS0 + i * 4
      if (Math.round(p[b]) !== this.step) continue
      let v = -1
      for (let k = 0; k < voices; k++) if (this.note[k] < 0) {
        v = k
        break
      }
      if (v < 0) {
        v = 0
        for (let k = 1; k < voices; k++) if (this.left[k] < this.left[v]) v = k
      }
      // every new note opens with the gap: a voice whose last note ended on
      // this very step (back to back, or a chord change) must still retrigger
      this.gap[v] = Math.round(RETRIG_S * this.fs)
      this.note[v] = Math.round(p[b + 2])
      this.left[v] = Math.max(1, Math.round(p[b + 1]))
      this.vel[v] = p[b + 3]
    }
  }

  tick(): void {
    const p = this.p
    const voices = Math.max(1, Math.min(MAX_VOICES, Math.round(p[this.pVoices])))
    const running = p[this.pRun] >= 0.5
    const c = this.clock
    const stepped = c.tick(running, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.pTempo], p[this.pSwing], this.in[this.iRst])
    // starting over clears first: the step it starts on plays
    if (c.restarted || !running) {
      this.step = -1
      this.release()
    }
    if (stepped) this.advance(voices)
    const base = p[this.pOct] + this.in[this.iTrans] - 2
    for (let v = 0; v < voices; v++) {
      const n = this.note[v]
      if (n >= 0) {
        this.pout(this.oPitch, v, base + n / 12)
        this.pout(this.oVel, v, this.vel[v] * 10)
      }
      if (this.gap[v] > 0) this.gap[v]--
      this.pout(this.oGate, v, n >= 0 && this.gap[v] === 0 ? 10 : 0)
      this.led[PRL.voice0 + v] = n
    }
    for (let v = voices; v < MAX_VOICES; v++) this.led[PRL.voice0 + v] = -1
    this.chans[this.oPitch] = voices
    this.chans[this.oGate] = voices
    this.chans[this.oVel] = voices
    this.out[this.oEol] = this.eol > 0 ? 10 : 0
    // the sustain pedal lane: down or up on the step playing
    const s = this.step
    this.out[this.oPed] = running && s >= 0 && pedalAt(p[this.pP0 + Math.floor(s / PR_STEPS_PER_BAR)], s) ? 10 : 0
    if (this.eol > 0) this.eol--
    this.led[PRL.step] = this.step
  }
}
