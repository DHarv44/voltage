import { Dsp } from './base'
import { Schmitt } from './cores'
import { DRUM_CHANNEL, type MidiEvent, type UiEvent } from '../protocol'
import { padForNote } from '../drumMap'
import { StepSeqCore, hasStep } from './stepSeq'
import { TR_CHAINS, TR_PATTERN_MAP } from '../../modules/specs/rhythm'

const PADS = 8
const LED_DECAY = 0.9995

/** 8 velocity pads. Each pad output is a gate while held (≥5 ms, so a quick
 *  tap still fires drums); VEL holds the last velocity, CV = last pad / 12 V. */
export class PadsDsp extends Dsp {
  private held = new Uint8Array(PADS)
  private minHold = new Int32Array(PADS)
  private vel = 0
  private last = 0

  private press(i: number, vel: number, down: boolean): void {
    if (i < 0 || i >= PADS) return
    if (down) {
      this.held[i] = 1
      this.minHold[i] = Math.round(0.005 * this.fs)
      this.vel = vel
      this.last = i
      this.led[i] = 1
    } else this.held[i] = 0
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'pad') this.press(ev.index, ev.vel, ev.down)
  }

  onMidi(ev: MidiEvent): void {
    if ((ev.kind === 'on' || ev.kind === 'off') && ev.ch === DRUM_CHANNEL)
      this.press(padForNote(ev.note), ev.kind === 'on' ? ev.vel : 0, ev.kind === 'on')
  }

  tick(): void {
    const o = this.out
    let any = false
    for (let i = 0; i < PADS; i++) {
      const on = this.held[i] === 1 || this.minHold[i] > 0
      if (this.minHold[i] > 0) this.minHold[i]--
      o[i] = on ? 10 : 0
      any ||= on
      if (!this.held[i]) this.led[i] *= LED_DECAY
    }
    o[PADS] = (this.vel / 127) * 10
    o[PADS + 1] = any ? 10 : 0
    o[PADS + 2] = this.last / 12
  }
}

const TRACKS = 8
const TRIG_MS = 0.005

/** TR-style drum sequencer. Patterns are 16-bit masks (one param per track per
 *  pattern) so they save with the patch. In REC mode, rising edges on R1–R8 are
 *  quantised to the nearest step and written into the playing pattern; if that
 *  step is still ahead, it's skipped once so the live hit doesn't double. */
export class Tr16Dsp extends Dsp {
  private iClk = this.ii('clk')
  private iRst = this.ii('rst')
  private iRec = Array.from({ length: TRACKS }, (_, t) => this.ii(`r${t + 1}`))
  private iPat = this.ii('pat')
  private oAcc = this.oi('acc')
  private oTrk = Array.from({ length: TRACKS }, (_, t) => this.oi(`t${t + 1}`))
  /** Mask param indices per pattern A–D (8 tracks + accent each). */
  private banks = ['a', 'b', 'c', 'd'].map((x) => Array.from({ length: TRACKS + 1 }, (_, t) => this.pi(`${x}${t}`)))
  private pLen = this.pi('len')
  private pSwing = this.pi('swing')
  private pPat = this.pi('pat')
  private pRec = this.pi('rec')

  private readonly seq = new StepSeqCore(this.fs)
  private readonly clk = new Schmitt()
  private readonly rst = new Schmitt()
  private readonly recIn = Array.from({ length: TRACKS }, () => new Schmitt())
  private readonly pulse = new Int32Array(TRACKS + 1)
  private readonly skip = new Int32Array(TRACKS).fill(-1)
  private readonly trigLen = Math.round(TRIG_MS * this.fs)
  private playing = 0
  private chainPos = 0
  private lastFired = -1

  private masks(pattern: number): number[] {
    return this.banks[pattern] ?? this.banks[0]
  }

  /** Pattern being edited/cleared: the selected one, or the playing one in a chain. */
  private editPattern(): number {
    const m = TR_PATTERN_MAP[Math.round(this.p[this.pPat])] ?? 0
    return m >= 0 ? m : this.playing
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'button' && ev.name === 'clear' && ev.down)
      for (const idx of this.masks(this.editPattern())) this.writeParam(idx, 0)
  }

  tick(): void {
    const i = this.in
    const p = this.p
    const len = Math.max(1, Math.round(p[this.pLen]))
    const pat = Math.round(p[this.pPat])
    // PAT patched: its voltage picks A–D in 2.5 V bands (ARRANGER's PAT), read
    // on each bar line, so a new pattern always starts on the one
    const byCv = this.patched[this.iPat] === 1
    const chain = byCv ? undefined : TR_CHAINS[pat]
    if (!chain && !byCv) this.playing = TR_PATTERN_MAP[pat] ?? 0

    if (this.rst.rise(i[this.iRst])) {
      this.seq.reset()
      this.lastFired = -1
      this.chainPos = 0
      if (chain) this.playing = chain[0]
    }
    const fire = this.seq.tick(this.clk.rise(i[this.iClk]), len, p[this.pSwing])
    if (fire >= 0) {
      if (byCv && (fire === 0 || this.lastFired < 0)) this.playing = Math.max(0, Math.min(3, Math.floor(i[this.iPat] / 2.5)))
      else if (chain && fire === 0 && this.lastFired >= 0) {
        // Song mode: move to the next pattern in the chain at each bar.
        this.chainPos = (this.chainPos + 1) % chain.length
        this.playing = chain[this.chainPos]
      } else if (chain && this.lastFired < 0) this.playing = chain[this.chainPos % chain.length]
      this.lastFired = fire
      const m = this.masks(this.playing)
      for (let t = 0; t < TRACKS; t++) {
        if (this.skip[t] === fire) {
          this.skip[t] = -1
          continue
        }
        if (hasStep(p[m[t]], fire)) this.pulse[t] = this.trigLen
      }
      if (hasStep(p[m[TRACKS]], fire)) this.pulse[TRACKS] = this.trigLen
    }

    const recording = p[this.pRec] >= 0.5
    for (let t = 0; t < TRACKS; t++) {
      if (this.recIn[t].rise(i[this.iRec[t]]) && recording) {
        const s = this.seq.nearestStep(len)
        const idx = this.masks(this.playing)[t]
        this.writeParam(idx, p[idx] | (1 << s))
        if (s !== this.seq.step) this.skip[t] = s
      }
    }

    const o = this.out
    for (let t = 0; t < TRACKS; t++) {
      o[this.oTrk[t]] = this.pulse[t] > 0 ? 10 : 0
      if (this.pulse[t] > 0) this.pulse[t]--
    }
    o[this.oAcc] = this.pulse[TRACKS] > 0 ? 10 : 0
    if (this.pulse[TRACKS] > 0) this.pulse[TRACKS]--

    this.led[0] = this.seq.step
    this.led[1] = this.playing
    this.led[2] = recording ? 1 : 0
  }
}
