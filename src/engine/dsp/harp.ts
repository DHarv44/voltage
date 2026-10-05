import type { ModuleSpec } from '../../modules/types'
import { HARP_STRINGS, HARPL, harpSemi } from '../../modules/specs/harp'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Changed } from './biquad'
import { Schmitt } from './cores'
import { DelayLine } from './delayLine'
import { C4 } from './util'

const CTRL = 64

/** A plucked string (Karplus-Strong with a one-zero loss filter). Silent
 *  strings are skipped entirely. */
class HString {
  readonly line: DelayLine
  period = 100
  loss = 0.99
  private z = 0
  private excite = 0
  private exLen = 1
  private bright = 0.5
  private seed: number
  live = 0
  constructor(max: number, seed: number) {
    this.line = new DelayLine(max)
    this.seed = seed | 1
  }
  pluck(vel: number, bright: number): void {
    this.exLen = Math.max(2, Math.round(this.period))
    this.excite = this.exLen
    this.bright = bright
    this.vel = vel
    this.live = 1
  }
  private vel = 1
  step(): number {
    let x = 0
    if (this.excite > 0) {
      // finger pluck: a triangle-ish shape, softened by plucking near the middle
      const t = 1 - this.excite / this.exLen
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
      // zero-mean, so the string carries no DC
      x = (0.5 - Math.abs(2 * t - 1)) * this.vel * 1.2 + (this.seed / 2147483648) * this.bright * this.vel * 0.15
      this.excite--
    }
    const y = this.line.tapLin(this.period)
    const filtered = (y + this.z) * 0.5
    this.z = y
    this.line.write(x + filtered * this.loss)
    if (Math.abs(y) < 1e-5 && this.excite === 0) this.live *= 0.999
    return y
  }
}

export class HarpDsp extends Dsp {
  private readonly iTrig = this.ii('trig')
  private readonly iV = this.ii('voct')
  private readonly pKey = this.pi('key')
  private readonly pSustain = this.pi('sustain')
  private readonly pBright = this.pi('bright')
  private readonly pLevel = this.pi('level')
  private readonly strings: HString[]
  private readonly trig = new Schmitt()
  private readonly changed = new Changed()
  private n = CTRL
  private pitch = 0
  private gate = 0
  private last = -1
  private flash = 0
  private body = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.strings = Array.from({ length: HARP_STRINGS }, (_, i) => new HString(Math.ceil(fs / 60), seed + i * 104729))
  }

  private retune(): void {
    const p = this.p
    const key = Math.round(p[this.pKey])
    for (let i = 0; i < HARP_STRINGS; i++) {
      const f = C4 * Math.pow(2, harpSemi(i, key) / 12)
      const s = this.strings[i]
      s.period = this.fs / f - 0.5 // the loss filter's half-sample delay
      // low strings ring for seconds, the top ones under one
      const t60 = (7 - (i / HARP_STRINGS) * 6) * p[this.pSustain]
      s.loss = Math.pow(10, -3 / (f * t60))
    }
  }

  private pluck(i: number, vel: number): void {
    if (i < 0 || i >= HARP_STRINGS) return
    this.strings[i].pluck(vel, this.p[this.pBright])
    this.pitch = harpSemi(i, Math.round(this.p[this.pKey])) / 12
    this.gate = Math.round(0.01 * this.fs)
    this.last = i
    this.flash = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'surface' && ev.name === 'pluck' && ev.down) this.pluck(Math.round(ev.x), Math.min(1, Math.max(0.1, ev.y)))
  }

  tick(): void {
    const p = this.p
    if (++this.n >= CTRL) {
      this.n = 0
      if (this.changed.test(p[this.pKey], p[this.pSustain])) this.retune()
    }
    if (this.trig.rise(this.in[this.iTrig])) {
      const want = this.in[this.iV] * 12
      const key = Math.round(p[this.pKey])
      let best = 0
      for (let i = 1; i < HARP_STRINGS; i++) if (Math.abs(harpSemi(i, key) - want) < Math.abs(harpSemi(best, key) - want)) best = i
      this.pluck(best, 0.8)
    }
    let y = 0
    for (const s of this.strings) if (s.live > 0.01) y += s.step()
    // soundboard: a gentle low-mid body
    this.body += (y - this.body) * 0.25
    this.out[0] = Math.tanh(this.body * 1.2) * 5 * p[this.pLevel]
    this.out[1] = this.pitch
    this.out[2] = this.gate > 0 ? 10 : 0
    if (this.gate > 0) this.gate--
    this.flash *= 0.9997
    this.led[HARPL.string] = this.last
    this.led[HARPL.flash] = this.flash
  }
}
