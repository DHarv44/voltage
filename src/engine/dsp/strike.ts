import type { ModuleSpec } from '../../modules/types'
import { STRIKE_INSTRUMENTS, STRIKEL } from '../../modules/specs/strike'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Biquad } from './biquad'
import { Schmitt } from './cores'
import { ModalVoice } from './modal'
import { C4 } from './util'

/** Struck tuned instruments. One modal resonator per note of every instrument
 *  (built once, so switching never allocates on the audio thread). */
export class StrikeDsp extends Dsp {
  private readonly iTrig = this.ii('trig')
  private readonly iV = this.ii('voct')
  private readonly iVel = this.ii('vel')
  private readonly pInst = this.pi('inst')
  private readonly pDecay = this.pi('decay')
  private readonly pBright = this.pi('bright')
  private readonly pLevel = this.pi('level')
  private readonly voices: ModalVoice[][]
  private readonly tuning: number[][]
  private readonly trig = new Schmitt()
  private readonly body: Biquad
  private lastDecay = -1
  private pitch = 0
  private gate = 0
  private note = -1
  private flash = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.voices = STRIKE_INSTRUMENTS.map((ins) => ins.notes.map(() => new ModalVoice(ins.partials)))
    // hand-tuned instruments are never perfect: a few cents per note
    this.tuning = STRIKE_INSTRUMENTS.map((ins) => ins.notes.map(() => this.rng.gauss() * 0.003))
    this.body = new Biquad(fs).peak(260, 1.2, 6) // kalimba's box
  }

  private retune(mult: number): void {
    STRIKE_INSTRUMENTS.forEach((ins, i) =>
      ins.notes.forEach((n, k) => this.voices[i][k].tune(C4 * Math.pow(2, n.semi / 12 + this.tuning[i][k]), ins.decay * mult * (1.3 - n.semi / 60), this.fs)),
    )
    this.lastDecay = mult
  }

  private hit(k: number, vel: number): void {
    const i = this.inst()
    const ins = STRIKE_INSTRUMENTS[i]
    if (k < 0 || k >= ins.notes.length) return
    const bright = Math.min(1, ins.bright * 0.5 + this.p[this.pBright] * 0.7) * (0.5 + vel * 0.5)
    this.voices[i][k].strike(vel, bright)
    this.pitch = ins.notes[k].semi / 12
    this.gate = Math.round(0.01 * this.fs)
    this.note = k
    this.flash = 1
  }

  private inst(): number {
    return Math.min(STRIKE_INSTRUMENTS.length - 1, Math.max(0, Math.round(this.p[this.pInst])))
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'hit' && ev.down) this.hit(Math.round(ev.x), Math.min(1, Math.max(0.1, ev.y)))
  }

  tick(): void {
    const p = this.p
    if (p[this.pDecay] !== this.lastDecay) this.retune(p[this.pDecay])
    const i = this.inst()
    if (this.trig.rise(this.in[this.iTrig])) {
      // CV plays the instrument's nearest note.
      const want = this.in[this.iV] * 12
      const notes = STRIKE_INSTRUMENTS[i].notes
      let best = 0
      for (let k = 1; k < notes.length; k++) if (Math.abs(notes[k].semi - want) < Math.abs(notes[best].semi - want)) best = k
      this.hit(best, this.patched[this.iVel] ? Math.min(1, Math.max(0.05, this.in[this.iVel] / 10)) : 0.8)
    }
    let y = 0
    const vs = this.voices[i]
    for (let k = 0; k < vs.length; k++) y += vs[k].step()
    if (i === 2) y = this.body.run(y)
    this.out[0] = Math.tanh(y * 0.5) * 5 * p[this.pLevel]
    this.out[1] = this.pitch
    this.out[2] = this.gate > 0 ? 10 : 0
    if (this.gate > 0) this.gate--
    this.flash *= 0.9998
    this.led[STRIKEL.note] = this.note
    this.led[STRIKEL.flash] = this.flash
  }
}
