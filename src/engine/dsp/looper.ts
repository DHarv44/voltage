import { Dsp } from './base'
import { Schmitt } from './cores'
import type { UiEvent } from '../protocol'
import { TAU, fastTanh } from './util'

const MAX_SECONDS = 60
const enum S {
  Empty,
  Rec,
  Play,
  Dub,
  Stop,
}
type Action = 'rec' | 'play' | 'clear'

/** Tape-style mono looper.
 *  REC: empty → record; recording → close loop & play; playing ↔ overdub; stopped → overdub.
 *  PLAY: recording → close & play; playing/overdub → stop; stopped → play from top.
 *  With CLK patched, REC and PLAY wait for the next clock edge (bar-synced loops).
 *  Overdub keeps OVERDUB × the old pass (tape generation loss) and saturates like
 *  tape; SPEED/SPD CV are varispeed (pitch follows), WOW wobbles the transport. */
export class LooperDsp extends Dsp {
  private iIn = this.ii('in')
  private iRec = this.ii('rec')
  private iPlay = this.ii('play')
  private iClear = this.ii('clear')
  private iClk = this.ii('clk')
  private iSpeed = this.ii('speed')
  private pLevel = this.pi('level')
  private pSpeed = this.pi('speed')
  private pFb = this.pi('fb')
  private pWow = this.pi('wow')
  private pDir = this.pi('dir')

  private readonly buf = new Float32Array(Math.round(MAX_SECONDS * this.fs))
  private len = 0
  private pos = 0
  private state = S.Empty
  private pending: Action | null = null
  private readonly trigRec = new Schmitt()
  private readonly trigPlay = new Schmitt()
  private readonly trigClear = new Schmitt()
  private readonly clk = new Schmitt()
  private eol = 0
  private wowPh = 0
  private flutPh = 0

  onUi(ev: UiEvent): void {
    if (ev.kind === 'button' && ev.down && (ev.name === 'rec' || ev.name === 'play' || ev.name === 'clear'))
      this.press(ev.name)
  }

  private press(a: Action): void {
    if (a !== 'clear' && this.patched[this.iClk]) this.pending = a
    else this.act(a)
  }

  private act(a: Action): void {
    switch (a) {
      case 'clear':
        this.state = S.Empty
        this.len = 0
        this.pos = 0
        this.pending = null
        break
      case 'rec':
        if (this.state === S.Empty) {
          this.state = S.Rec
          this.len = 0
        } else if (this.state === S.Rec) this.close()
        else if (this.state === S.Play) this.state = S.Dub
        else if (this.state === S.Dub) this.state = S.Play
        else if (this.state === S.Stop) this.state = S.Dub
        break
      case 'play':
        if (this.state === S.Rec) this.close()
        else if (this.state === S.Play || this.state === S.Dub) this.state = S.Stop
        else if (this.state === S.Stop) {
          this.state = S.Play
          this.pos = 0
        }
        break
    }
  }

  private close(): void {
    if (this.len < 64) {
      this.state = S.Empty
      this.len = 0
      return
    }
    this.state = S.Play
    this.pos = 0
  }

  private read(pos: number): number {
    const len = this.len
    const i0 = Math.floor(pos)
    const f = pos - i0
    const a = this.buf[i0 % len]
    const b = this.buf[(i0 + 1) % len]
    return a + (b - a) * f
  }

  tick(): void {
    const i = this.in
    const p = this.p
    const x = 8 * fastTanh(i[this.iIn] / 8) // tape input saturation

    if (this.trigRec.rise(i[this.iRec])) this.press('rec')
    if (this.trigPlay.rise(i[this.iPlay])) this.press('play')
    if (this.trigClear.rise(i[this.iClear])) this.act('clear')
    if (this.clk.rise(i[this.iClk]) && this.pending) {
      this.act(this.pending)
      this.pending = null
    }

    let wet = 0
    if (this.state === S.Rec) {
      this.buf[this.len++] = x
      if (this.len >= this.buf.length) this.close()
    } else if ((this.state === S.Play || this.state === S.Dub) && this.len > 0) {
      const wow = p[this.pWow]
      this.wowPh += 0.55 / this.fs
      this.flutPh += 7.3 / this.fs
      if (this.wowPh >= 1) this.wowPh -= 1
      if (this.flutPh >= 1) this.flutPh -= 1
      const transport = 1 + wow * (0.004 * Math.sin(TAU * this.wowPh) + 0.0012 * Math.sin(TAU * this.flutPh))
      const speed = p[this.pSpeed] * Math.pow(2, i[this.iSpeed]) * transport
      const dir = p[this.pDir] >= 0.5 ? -1 : 1
      wet = this.read(this.pos)
      if (this.state === S.Dub) {
        const w = Math.round(this.pos) % this.len
        this.buf[w] = 8 * fastTanh((this.buf[w] * p[this.pFb] + x) / 8)
      }
      this.pos += speed * dir
      if (this.pos >= this.len) {
        this.pos -= this.len
        this.eol = Math.round(0.005 * this.fs)
      } else if (this.pos < 0) {
        this.pos += this.len
        this.eol = Math.round(0.005 * this.fs)
      }
    }

    wet *= p[this.pLevel]
    const o = this.out
    o[0] = x + wet
    o[1] = wet
    o[2] = this.eol > 0 ? 10 : 0
    if (this.eol > 0) this.eol--

    const blink = this.pending ? (Math.floor(this.age * 6) % 2 === 0 ? 1 : 0.15) : 1
    this.led[0] = this.state === S.Rec || this.state === S.Dub ? blink : this.pending === 'rec' ? blink * 0.6 : 0
    this.led[1] = this.state === S.Play || this.state === S.Dub ? 1 : this.pending === 'play' ? blink * 0.6 : 0
    this.led[2] =
      this.state === S.Rec ? this.len / this.buf.length : this.len > 0 && this.state !== S.Empty ? this.pos / this.len : 0
  }
}
