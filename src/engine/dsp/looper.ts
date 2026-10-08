import { Dsp } from './base'
import { Schmitt } from './cores'
import type { UiEvent } from '../protocol'
import { TAU, fastTanh } from './util'

const SLOTS = 4
const SLOT_SECONDS = 20
const enum S {
  Empty,
  Rec,
  Play,
  Dub,
  Stop,
}
type Action = 'rec' | 'play' | 'clear' | 'undo'

/** Tape-style mono looper with 4 slots.
 *  REC: empty → record; recording → close loop & play; playing ↔ overdub; stopped → overdub.
 *  PLAY: recording → close & play; playing/overdub → stop; stopped → play from top.
 *  UNDO swaps the last overdub pass out (press again to redo). Only the samples an
 *  overdub actually overwrote are saved, as the tape passes, so undo never stalls audio.
 *  ½× record: tape runs at half speed while recording (plays back an octave up).
 *  With CLK patched, REC and PLAY wait for the next clock edge (bar-synced loops). */
export class LooperDsp extends Dsp {
  private iIn = this.ii('in')
  private iRec = this.ii('rec')
  private iPlay = this.ii('play')
  private iClear = this.ii('clear')
  private iClk = this.ii('clk')
  private iSpeed = this.ii('speed')
  private iRst = this.ii('rst')
  private pLevel = this.pi('level')
  private pSpeed = this.pi('speed')
  private pFb = this.pi('fb')
  private pWow = this.pi('wow')
  private pDir = this.pi('dir')
  private pSlot = this.pi('slot')
  private pRspeed = this.pi('rspeed')

  private readonly max = Math.round(SLOT_SECONDS * this.fs)
  private readonly bufs = Array.from({ length: SLOTS }, () => new Float32Array(this.max))
  private readonly lens = new Int32Array(SLOTS)
  private slot = 0
  private pos = 0
  private state = S.Empty
  private pending: Action | null = null
  // Undo: old values of samples overwritten by the current overdub generation.
  private readonly backup = new Float32Array(this.max)
  private readonly stamp = new Uint32Array(this.max)
  private gen = 1
  private undoSlot = -1
  // Half-speed recording accumulator
  private recPos = 0
  private acc = 0
  private accN = 0

  private readonly trigRec = new Schmitt()
  private readonly trigPlay = new Schmitt()
  private readonly trigClear = new Schmitt()
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private eol = 0
  private wowPh = 0
  private flutPh = 0

  private get buf(): Float32Array {
    return this.bufs[this.slot]
  }
  private get len(): number {
    return this.lens[this.slot]
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'button' || !ev.down) return
    if (ev.name === 'rec' || ev.name === 'play') this.press(ev.name)
    else if (ev.name === 'clear' || ev.name === 'undo') this.act(ev.name)
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot < 0 || slot >= SLOTS) return
    const n = Math.min(this.max, data.length)
    this.bufs[slot].set(data.subarray(0, n))
    this.lens[slot] = n
    if (slot === this.slot && this.state === S.Empty && n > 0) this.state = S.Stop
    void rate // loops are recorded at the engine rate
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    if (slot < 0 || slot >= SLOTS || this.lens[slot] === 0) return null
    return { rate: this.fs, data: this.bufs[slot].slice(0, this.lens[slot]) }
  }

  /** Report the slot's audio for persistence. */
  private persist(slot = this.slot): void {
    this.bufferOut.push({ slot, rate: this.fs, data: this.bufs[slot].subarray(0, this.lens[slot]) })
  }

  private press(a: Action): void {
    if (this.patched[this.iClk]) this.pending = a
    else this.act(a)
  }

  private act(a: Action): void {
    const st = this.state
    switch (a) {
      case 'clear':
        this.state = S.Empty
        this.lens[this.slot] = 0
        this.pos = 0
        this.pending = null
        if (this.undoSlot === this.slot) this.undoSlot = -1
        this.persist()
        break
      case 'undo':
        this.swapUndo()
        break
      case 'rec':
        if (st === S.Empty) {
          this.state = S.Rec
          this.lens[this.slot] = 0
          this.recPos = 0
          this.acc = 0
          this.accN = 0
        } else if (st === S.Rec) this.close()
        else if (st === S.Play || st === S.Stop) this.startDub()
        else if (st === S.Dub) this.endDub(S.Play)
        break
      case 'play':
        if (st === S.Rec) this.close()
        else if (st === S.Play) this.state = S.Stop
        else if (st === S.Dub) this.endDub(S.Stop)
        else if (st === S.Stop) {
          this.state = S.Play
          this.pos = 0
        }
        break
    }
  }

  private startDub(): void {
    this.gen = this.gen === 0xffffffff ? 1 : this.gen + 1
    this.undoSlot = this.slot
    this.state = S.Dub
  }

  private endDub(next: S): void {
    this.state = next
    this.persist()
  }

  /** Swap samples touched by the last overdub with their saved originals (undo ↔ redo). */
  private swapUndo(): void {
    if (this.undoSlot !== this.slot || this.state === S.Rec) return
    if (this.state === S.Dub) this.state = S.Play
    const b = this.buf
    const n = this.len
    for (let k = 0; k < n; k++)
      if (this.stamp[k] === this.gen) {
        const t = b[k]
        b[k] = this.backup[k]
        this.backup[k] = t
      }
    this.persist()
  }

  private close(): void {
    if (this.len < 64) {
      this.state = S.Empty
      this.lens[this.slot] = 0
      return
    }
    this.state = S.Play
    this.pos = 0
    this.persist()
  }

  private selectSlot(s: number): void {
    if (s === this.slot) return
    if (this.state === S.Rec) this.close()
    else if (this.state === S.Dub) this.endDub(S.Play)
    this.slot = s
    this.pending = null
    const playing = this.state === S.Play
    this.state = this.len === 0 ? S.Empty : playing ? S.Play : S.Stop
    if (this.len > 0) this.pos %= this.len
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

    this.selectSlot(Math.max(0, Math.min(SLOTS - 1, Math.round(p[this.pSlot]))))
    if (this.trigRec.rise(i[this.iRec])) this.press('rec')
    if (this.trigPlay.rise(i[this.iPlay])) this.press('play')
    if (this.trigClear.rise(i[this.iClear])) this.act('clear')
    if (this.clk.rise(i[this.iClk]) && this.pending) {
      this.act(this.pending)
      this.pending = null
    }
    // RST: the loop goes back to its start (its end, playing backwards), on the downbeat
    if (this.rst.rise(i[this.iRst]) && this.len > 0) this.pos = p[this.pDir] >= 0.5 ? this.len - 1 : 0

    let wet = 0
    if (this.state === S.Rec) this.record(x, p[this.pRspeed] >= 0.5)
    else if ((this.state === S.Play || this.state === S.Dub) && this.len > 0) {
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
        if (this.stamp[w] !== this.gen) {
          this.stamp[w] = this.gen
          this.backup[w] = this.buf[w]
        }
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
    this.led[2] = this.state === S.Rec ? this.len / this.max : this.len > 0 && this.state !== S.Empty ? this.pos / this.len : 0
  }

  /** First pass. At ½× the tape moves half as fast: pairs of input samples are
   *  averaged into one (a gentle anti-alias), so the loop plays back an octave up. */
  private record(x: number, half: boolean): void {
    if (!half) {
      this.buf[this.lens[this.slot]++] = x
    } else {
      this.acc += x
      if (++this.accN === 2) {
        this.buf[this.lens[this.slot]++] = this.acc / 2
        this.acc = 0
        this.accN = 0
      }
    }
    if (this.len >= this.max) this.close()
  }
}
