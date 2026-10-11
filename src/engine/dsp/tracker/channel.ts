import { TK_OFF, type Cell } from '../../../modules/specs/tracker'
import { quantise } from '../sampling/converter'
import { LOOP_FWD, LOOP_OFF, SampleVoice } from '../sampling/voice'
import type { FactorySample } from '../sampling/factory'

/** Semitones per "period unit" of a slide (roughly, around the middle). */
const SLIDE = 0.045

/** One tracker channel: a voice and the state its effects work on: the
 *  pitch (in semitones), the volume (0–64), the effect running this row and
 *  the memories the effects keep. */
export class TrackerChannel {
  readonly voice: SampleVoice
  sample: FactorySample | null = null
  semi = 60
  vol = 64
  private target = 60
  private fx = 0
  private fxp = 0
  private portaSpeed = 0
  private vibSpeed = 0
  private vibDepth = 0
  private vibPh = 0
  private arpBase = 60

  constructor(fs: number) {
    this.voice = new SampleVoice(fs)
    this.voice.variable = true
    this.voice.attack = 0.0005
    this.voice.release = 0.01
  }

  /** A row arrives: its note (if any), sample (if any) and effect. */
  row(c: Cell, samples: (FactorySample | null)[]): void {
    this.fx = c.fx
    this.fxp = c.fxp
    if (c.smp > 0) {
      this.sample = samples[c.smp - 1] ?? this.sample
      this.vol = 64
    }
    if (c.note === TK_OFF) this.voice.noteOff()
    else if (c.note > 0) {
      const midi = c.note + 11
      if (c.fx === 0x3 && this.voice.active) this.target = midi // tone portamento: glide, don't restart
      else {
        this.semi = midi
        this.target = midi
        this.vibPh = 0
        this.start(c.fx === 0x9 ? c.fxp * 256 : 0)
      }
    }
    this.arpBase = this.semi
    // effects that happen once, on the row's first tick
    const x = this.fxp >> 4
    const y = this.fxp & 15
    if (this.fx === 0x3 && this.fxp) this.portaSpeed = this.fxp
    if (this.fx === 0x4) {
      if (x) this.vibSpeed = x
      if (y) this.vibDepth = y
    }
    if (this.fx === 0xc) this.vol = Math.min(64, this.fxp)
    this.apply(0)
  }

  private start(offset: number): void {
    const s = this.sample
    if (!s) return
    const looped = s.loopEnd > s.loopStart
    this.voice.loop = looped ? LOOP_FWD : LOOP_OFF
    this.voice.loopStart = looped ? s.loopStart : 0
    this.voice.loopEnd = looped ? s.loopEnd : 0
    this.voice.trigger(s, Math.min(s.len - 1, offset), s.len, 1, 1)
  }

  /** Tick t of the row (0 = its first): the running effects move on. */
  tick(t: number): void {
    const x = this.fxp >> 4
    const y = this.fxp & 15
    switch (this.fx) {
      case 0x1:
        if (t > 0) this.semi += this.fxp * SLIDE
        break
      case 0x2:
        if (t > 0) this.semi -= this.fxp * SLIDE
        break
      case 0x3:
        if (t > 0) {
          const d = this.target - this.semi
          const step = this.portaSpeed * SLIDE
          this.semi = Math.abs(d) <= step ? this.target : this.semi + Math.sign(d) * step
        }
        break
      case 0x4:
        if (t > 0) this.vibPh += this.vibSpeed / 64
        break
      case 0xa:
        if (t > 0) this.vol = Math.max(0, Math.min(64, this.vol + x - y))
        break
      case 0xe:
        if (x === 0x9 && y > 0 && t > 0 && t % y === 0) this.start(0) // retrigger
        if (x === 0xc && t === y) this.vol = 0 // note cut
        break
    }
    this.apply(t)
  }

  /** The voice's speed from the pitch now (with arpeggio and vibrato on top). */
  private apply(t: number): void {
    let semi = this.semi
    if (this.fx === 0x0 && this.fxp) {
      const k = t % 3
      semi = this.arpBase + (k === 1 ? this.fxp >> 4 : k === 2 ? this.fxp & 15 : 0)
    }
    if (this.fx === 0x4) semi += Math.sin(this.vibPh * 2 * Math.PI) * this.vibDepth * 0.06
    const root = this.sample?.root ?? 60
    this.voice.ratio = Math.pow(2, (semi - root) / 12)
  }

  /** One sample: through the chip's 8 bits, then the channel's volume. */
  step(): number {
    if (!this.voice.active) return 0
    return quantise(Math.max(-1, Math.min(1, this.voice.step())), 8, false) * (this.vol / 64)
  }
}
