import { Dsp } from './base'
import type { MidiEvent } from '../protocol'
import { AudioOutCore, KeyboardCore } from './cores'

/** Mono last-note-priority MIDI→CV. 0 V = MIDI note 60 (C4). */
export class MidiCvDsp extends Dsp {
  private pGlide = this.pi('glide')
  private pOct = this.pi('oct')
  private readonly kb = new KeyboardCore()

  onMidi(ev: MidiEvent): void {
    this.kb.midi(ev, this.fs)
  }

  tick(): void {
    const kb = this.kb
    kb.step(this.p[this.pGlide], this.fs)
    const o = this.out
    o[0] = kb.pitch + this.p[this.pOct] + (kb.bend * 2) / 12
    o[1] = kb.gate ? 10 : 0
    o[2] = (kb.vel / 127) * 10
    o[3] = (kb.mod / 127) * 10
    o[4] = kb.trig > 0 ? 10 : 0
    o[5] = kb.bend * 5
    this.led[0] = kb.gate ? 1 : 0
  }
}

/** The audio interface: AC-coupled (DC never reaches your speakers),
 *  audio-taper volume, soft limiter above −1 dBFS. R is normalled to L. */
export class OutputDsp extends Dsp {
  sink = true
  private iL = this.ii('l')
  private iR = this.ii('r')
  private pVol = this.pi('vol')
  private readonly left = new AudioOutCore(this.fs)
  private readonly right = new AudioOutCore(this.fs)

  tick(): void {
    const l = this.in[this.iL]
    const r = this.patched[this.iR] ? this.in[this.iR] : l
    const vol = this.p[this.pVol]
    this.audioL = this.left.process(l, vol)
    this.audioR = this.right.process(r, vol)
    this.led[0] = this.left.peak * 1.5
    this.led[1] = this.right.peak * 1.5
  }
}

const SCOPE_N = 256

/** Dual-trace capture: arm → wait for CH1 rising through 0 V (or auto-trigger
 *  after a timeout) → decimate one screen into a frame → hold until collected. */
export class ScopeDsp extends Dsp {
  private i1 = this.ii('ch1')
  private i2 = this.ii('ch2')
  private pTime = this.pi('time')
  private pTrig = this.pi('trig')
  private frame = new Float32Array(SCOPE_N * 2)
  private state = 0 // 0 armed, 1 capturing, 2 ready
  private idx = 0
  private acc = 0
  private wait = 0
  private prev = 0

  tick(): void {
    const a = this.in[this.i1]
    const b = this.in[this.i2]
    const screen = this.p[this.pTime] * this.fs
    if (this.state === 0) {
      const timeout = this.wait++ > Math.max(0.1 * this.fs, 2 * screen)
      if (this.p[this.pTrig] >= 0.5 || timeout || (a > 0 && this.prev <= 0)) {
        this.state = 1
        this.idx = 0
        this.acc = 0
      }
    }
    this.prev = a
    if (this.state === 1 && --this.acc <= 0) {
      this.acc += Math.max(1, screen / SCOPE_N)
      this.frame[this.idx] = a
      this.frame[SCOPE_N + this.idx] = b
      if (++this.idx === SCOPE_N) this.state = 2
    }
  }

  takeFrame(): Float32Array | null {
    if (this.state !== 2) return null
    this.state = 0
    this.wait = 0
    return this.frame.slice()
  }
}
