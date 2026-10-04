import type { ModuleSpec } from '../../modules/types'
import { GAMELAN_INSTRUMENTS, GAML, gamelanKeys } from '../../modules/specs/gamelan'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Changed } from './biquad'
import { Schmitt } from './cores'
import { ModalVoice } from './modal'
import { C4 } from './util'

const MAX_KEYS = 15
const CTRL = 64
const GONG = 2

/** Gamelan: each key is a pair of modal resonators OMBAK Hz apart. */
export class GamelanDsp extends Dsp {
  private readonly iTrig = this.ii('trig')
  private readonly iV = this.ii('voct')
  private readonly pInst = this.pi('inst')
  private readonly pTuning = this.pi('tuning')
  private readonly pBase = this.pi('base')
  private readonly pOmbak = this.pi('ombak')
  private readonly pDecay = this.pi('decay')
  private readonly pLevel = this.pi('level')
  /** [instrument][key][pair half] */
  private readonly voices: ModalVoice[][][]
  private keys: number[] = []
  private readonly trig = new Schmitt()
  private readonly changed = new Changed()
  private n = CTRL
  private gongAge = 1e9
  private pitch = 0
  private gate = 0
  private key = -1
  private flash = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.voices = GAMELAN_INSTRUMENTS.map((g) => Array.from({ length: MAX_KEYS }, () => [new ModalVoice(g.partials), new ModalVoice(g.partials)]))
  }

  private inst(): number {
    return Math.min(GAMELAN_INSTRUMENTS.length - 1, Math.max(0, Math.round(this.p[this.pInst])))
  }

  private retune(sag = 1): void {
    const p = this.p
    const i = this.inst()
    const g = GAMELAN_INSTRUMENTS[i]
    const ombak = p[this.pOmbak]
    for (let k = 0; k < this.keys.length; k++) {
      const cents = this.keys[k]
      const f = C4 * Math.pow(2, p[this.pBase] / 12 + cents / 1200) * sag
      const decay = g.decay * p[this.pDecay] * (1.2 - cents / 6000)
      this.voices[i][k][0].tune(f, decay, this.fs)
      this.voices[i][k][1].tune(f + ombak, decay, this.fs)
    }
  }

  private hit(k: number, vel: number): void {
    const i = this.inst()
    if (k < 0 || k >= this.keys.length) return
    for (const v of this.voices[i][k]) v.strike(vel * 0.5, 0.7)
    if (i === GONG) this.gongAge = 0
    this.pitch = (this.p[this.pBase] + this.keys[k] / 100) / 12
    this.gate = Math.round(0.01 * this.fs)
    this.key = k
    this.flash = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'hit' && ev.down) this.hit(Math.round(ev.x), 0.85)
  }

  tick(): void {
    const p = this.p
    if (++this.n >= CTRL) {
      this.n = 0
      const i = this.inst()
      if (this.changed.test(i, p[this.pTuning], p[this.pBase], p[this.pOmbak], p[this.pDecay])) {
        this.keys = gamelanKeys(i, Math.round(p[this.pTuning]))
        this.retune()
      }
      // A struck gong's pitch sags a little as the metal relaxes.
      if (i === GONG && this.gongAge < 6) this.retune(1 - 0.012 * (1 - Math.exp(-this.gongAge / 1.5)))
    }
    this.gongAge += 1 / this.fs
    if (this.trig.rise(this.in[this.iTrig]) && this.keys.length) {
      const want = (this.in[this.iV] * 12 - p[this.pBase]) * 100
      let best = 0
      for (let k = 1; k < this.keys.length; k++) if (Math.abs(this.keys[k] - want) < Math.abs(this.keys[best] - want)) best = k
      this.hit(best, 0.85)
    }
    let y = 0
    const vs = this.voices[this.inst()]
    for (let k = 0; k < this.keys.length; k++) y += vs[k][0].step() + vs[k][1].step()
    this.out[0] = Math.tanh(y * 0.6) * 5 * p[this.pLevel]
    this.out[1] = this.pitch
    this.out[2] = this.gate > 0 ? 10 : 0
    if (this.gate > 0) this.gate--
    this.flash *= 0.9998
    this.led[GAML.key] = this.key
    this.led[GAML.flash] = this.flash
  }
}
