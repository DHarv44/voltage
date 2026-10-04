import type { ModuleSpec } from '../../../modules/types'
import type { UiEvent } from '../../protocol'
import { Dsp } from '../base'

const MAX_S = 60
const EMPTY = 0
const REC = 1
const PLAY = 2
const DUB = 3
const STOPPED = 4

/** One-switch looper pedal. Stomp: record → play → overdub → play …; STOP
 *  halts playback (stomp again to restart from the top); CLEAR erases. The
 *  loop is kept with the patch. Short fades at the loop seam stop clicks. */
export class LooperPedalDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly pOn = this.pi('on')
  private readonly pLevel = this.pi('level')
  private readonly buf: Float32Array
  private len = 0
  private pos = 0
  private state = EMPTY
  private lastOn = -1
  private readonly fade: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.buf = new Float32Array(MAX_S * fs)
    this.fade = Math.round(0.004 * fs)
  }

  private stomp(): void {
    if (this.state === EMPTY) {
      this.state = REC
      this.len = 0
    } else if (this.state === REC) {
      this.state = PLAY
      this.pos = 0
      this.save()
    } else if (this.state === PLAY) this.state = DUB
    else if (this.state === DUB) {
      this.state = PLAY
      this.save()
    } else if (this.state === STOPPED) {
      this.state = PLAY
      this.pos = 0
    }
  }

  private save(): void {
    if (this.len) this.bufferOut.push({ slot: 0, rate: this.fs, data: this.buf.subarray(0, this.len) })
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'button' || !ev.down) return
    if (ev.name === 'stop' && this.state !== EMPTY) {
      if (this.state === REC || this.state === DUB) this.save()
      this.state = STOPPED
    } else if (ev.name === 'clear') {
      this.state = EMPTY
      this.len = 0
      this.bufferOut.push({ slot: 0, rate: this.fs, data: new Float32Array(0) })
    }
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot !== 0 || rate !== this.fs) return
    this.len = Math.min(data.length, this.buf.length)
    this.buf.set(data.subarray(0, this.len))
    this.state = this.len ? STOPPED : EMPTY
  }

  dumpBuffer(): { rate: number; data: Float32Array } | null {
    return this.len ? { rate: this.fs, data: this.buf.slice(0, this.len) } : null
  }

  tick(): void {
    const on = this.p[this.pOn]
    if (this.lastOn >= 0 && on !== this.lastOn) this.stomp()
    this.lastOn = on
    const x = this.in[this.iIn]
    let loop = 0
    if (this.state === REC) {
      this.buf[this.len++] = x
      if (this.len >= this.buf.length) this.stomp()
    } else if ((this.state === PLAY || this.state === DUB) && this.len) {
      const i = this.pos
      const edge = Math.min(1, i / this.fade, (this.len - i) / this.fade)
      loop = this.buf[i] * edge
      if (this.state === DUB) this.buf[i] += x
      this.pos = i + 1 >= this.len ? 0 : i + 1
    }
    this.out[0] = x + loop * this.p[this.pLevel]
    const blink = (this.pos / this.fs) % 0.5 < 0.25
    this.led[0] = this.state === REC ? 1 : this.state === DUB ? (blink ? 1 : 0.3) : 0
    this.led[1] = this.state === PLAY || this.state === DUB ? 1 : 0
    this.led[2] = this.state === REC ? this.len / this.buf.length : this.len ? this.pos / this.len : 0
  }
}
