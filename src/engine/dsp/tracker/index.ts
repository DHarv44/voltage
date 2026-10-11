import { cellId, TK_CH, TK_ORDER, TK_ROWS, TKRL, packCell, unpackCell } from '../../../modules/specs/tracker'
import type { ModuleSpec } from '../../../modules/types'
import type { MidiEvent, UiEvent } from '../../protocol'
import { Biquad } from '../biquad'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { FACTORY_NAMES, makeFactory, type FactorySample } from '../sampling/factory'
import { TrackerChannel } from './channel'

/** The rate the factory sounds are made at: the classic tracker sample rate. */
const SAMPLE_RATE = 16726
const MAX_REC_S = 10
/** Channels 1 and 4 on the left, 2 and 3 on the right, as the chip had them. */
const PAN_LEFT = [1, 0, 0, 1]

/** TRACKER: ticks at BPM × 2 / 5 a second (125 BPM: 50 a second, the
 *  original's video rate), SPEED ticks a row; or a row on each CLK edge with
 *  its ticks spread over the measured gap. Rows read from the pattern the
 *  order list is on; pattern effects (break, speed) act here, the rest in
 *  each channel. EDIT on REC: notes from the keys are written at the cursor,
 *  which moves down a row. */
export class TrackerDsp extends Dsp {
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iIn = this.ii('in')
  private readonly iRecg = this.ii('recg')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly oCh0 = this.oi('ch1')
  private readonly P = {
    bpm: this.pi('bpm'),
    speed: this.pi('speed'),
    len: this.pi('len'),
    level: this.pi('level'),
    led: this.pi('led'),
    model: this.pi('model'),
    run: this.pi('run'),
    rec: this.pi('rec'),
    cur: this.pi('cur'),
    curch: this.pi('curch'),
    edpat: this.pi('edpat'),
    edsmp: this.pi('edsmp'),
    o0: this.pi('o0'),
    cell0: this.pi(cellId(0, 0, 0)),
  }
  private readonly ch: TrackerChannel[]
  private readonly samples: (FactorySample | null)[]
  private readonly user: FactorySample
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private readonly recg = new Schmitt()
  private readonly rcL: Biquad
  private readonly rcR: Biquad
  private readonly ledL: Biquad
  private readonly ledR: Biquad
  private readonly lvl = new Float64Array(TK_CH)
  private recording = false
  private ord = 0
  private row = -1
  /** The tick within the row (0 = its first). */
  private tk = 0
  private sinceTick = 0
  private sinceClk = 0
  private clkGap = 0.12
  private wasRunning = false
  private breakTo = -1

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.ch = Array.from({ length: TK_CH }, () => new TrackerChannel(fs))
    this.samples = FACTORY_NAMES.map((_, k) => makeFactory(k, SAMPLE_RATE))
    this.user = { name: 'YOURS', data: new Float32Array(Math.round(MAX_REC_S * fs)), len: 0, rate: fs, root: 60, loopStart: 0, loopEnd: 0 }
    this.samples.push(this.user)
    this.rcL = new Biquad(fs).lowpass(4400, 0.5)
    this.rcR = new Biquad(fs).lowpass(4400, 0.5)
    this.ledL = new Biquad(fs).lowpass(3300, 0.707)
    this.ledR = new Biquad(fs).lowpass(3300, 0.707)
  }

  private cell(pat: number, row: number, c: number): number {
    return this.p[this.P.cell0 + (pat * TK_ROWS + row) * TK_CH + c]
  }

  onMidi(ev: MidiEvent): void {
    if (ev.kind !== 'on' || this.p[this.P.rec] < 0.5) return
    // step entry: the note (and the chosen sample) into the cursor's cell, the cursor down a row
    const pat = Math.round(this.p[this.P.edpat])
    const row = Math.round(this.p[this.P.cur])
    const c = Math.round(this.p[this.P.curch])
    const note = Math.max(1, Math.min(96, ev.note - 11))
    const old = unpackCell(this.cell(pat, row, c))
    const smp = Math.round(this.p[this.P.edsmp])
    this.writeParam(this.P.cell0 + (pat * TK_ROWS + row) * TK_CH + c, packCell({ note, smp, fx: old.fx, fxp: old.fxp }))
    this.writeParam(this.P.cur, (row + 1) % TK_ROWS)
    this.ch[c].row({ note, smp, fx: 0, fxp: 0 }, this.samples) // hear it
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'button' && ev.name === 'sample' && ev.down) this.toggleRec()
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot !== 0) return
    const n = Math.min(this.user.data.length, data.length)
    this.user.data.set(data.subarray(0, n))
    this.user.len = n
    this.user.rate = rate
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    return slot === 0 && this.user.len ? { rate: this.user.rate, data: this.user.data.slice(0, this.user.len) } : null
  }

  private toggleRec(): void {
    this.recording = !this.recording
    if (this.recording) {
      this.user.len = 0
      this.user.rate = this.fs
    } else this.bufferOut.push({ slot: 0, rate: this.user.rate, data: this.user.data.subarray(0, this.user.len) })
  }

  /** The next row (and the next order position past the pattern's end or a break). */
  private nextRow(): void {
    const len = Math.max(1, Math.min(TK_ORDER, Math.round(this.p[this.P.len])))
    this.row++
    if (this.breakTo >= 0 || this.row >= TK_ROWS) {
      this.ord = (this.ord + 1) % len
      this.row = this.breakTo >= 0 ? this.breakTo : 0
      this.breakTo = -1
    }
    const pat = Math.round(this.p[this.P.o0 + this.ord])
    for (let c = 0; c < TK_CH; c++) {
      const cell = unpackCell(this.cell(pat, this.row, c))
      if (cell.fx === 0xd) this.breakTo = Math.min(TK_ROWS - 1, (cell.fxp >> 4) * 10 + (cell.fxp & 15))
      else if (cell.fx === 0xf && cell.fxp > 0) this.writeParam(cell.fxp < 32 ? this.P.speed : this.P.bpm, cell.fxp)
      this.ch[c].row(cell, this.samples)
    }
    this.tk = 0
  }

  tick(): void {
    const p = this.p
    const running = p[this.P.run] >= 0.5
    if ((running && !this.wasRunning) || this.rst.rise(this.in[this.iRst])) {
      this.ord = 0
      this.row = -1
      this.breakTo = -1
      this.sinceTick = 1e9 // the first row at once
    }
    this.wasRunning = running
    if (this.recg.rise(this.in[this.iRecg])) this.toggleRec()
    if (this.recording) {
      this.user.data[this.user.len++] = this.in[this.iIn] / 5
      if (this.user.len >= this.user.data.length) this.toggleRec()
    }
    const speed = Math.max(1, Math.round(p[this.P.speed]))
    if (running) {
      if (this.patched[this.iClk] === 1) {
        // a row on each CLK edge, its ticks spread over the gap between edges
        this.sinceClk++
        if (this.clk.rise(this.in[this.iClk])) {
          if (this.sinceClk < this.fs * 2) this.clkGap = this.sinceClk / this.fs
          this.sinceClk = 0
          this.nextRow()
          this.sinceTick = 0
        } else if (this.row >= 0 && ++this.sinceTick >= (this.clkGap * this.fs) / speed && this.tk < speed - 1) {
          this.sinceTick = 0
          this.tk++
          for (let c = 0; c < TK_CH; c++) this.ch[c].tick(this.tk)
        }
      } else if (++this.sinceTick >= (this.fs * 5) / (2 * p[this.P.bpm])) {
        this.sinceTick = 0
        if (this.row < 0 || this.tk >= speed - 1) this.nextRow()
        else {
          this.tk++
          for (let c = 0; c < TK_CH; c++) this.ch[c].tick(this.tk)
        }
      }
    }
    // the four channels, hard left and right, through the chip's output filters
    let l = 0
    let r = 0
    for (let c = 0; c < TK_CH; c++) {
      const y = this.ch[c].step()
      this.out[this.oCh0 + c] = y * 5
      if (PAN_LEFT[c]) l += y
      else r += y
      this.lvl[c] = Math.max(Math.abs(y), this.lvl[c] * 0.9995)
      this.led[TKRL.level0 + c] = this.lvl[c]
    }
    if (p[this.P.model] < 0.5) {
      l = this.rcL.run(l)
      r = this.rcR.run(r)
    }
    if (p[this.P.led] >= 0.5) {
      l = this.ledL.run(l)
      r = this.ledR.run(r)
    }
    const g = p[this.P.level] * 6
    // a little of each side in the other, as most people listened (headphones hate hard pans)
    this.out[this.oL] = (l + r * 0.25) * g
    this.out[this.oR] = (r + l * 0.25) * g
    this.led[TKRL.pat] = Math.round(p[this.P.o0 + this.ord])
    this.led[TKRL.row] = running ? this.row : -1
    this.led[TKRL.ord] = this.ord
    this.led[TKRL.level0 + TK_CH] = this.recording ? 1 : 0
  }
}
