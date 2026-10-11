import { CL, COMBO_PARTS, LEARN_FAILS } from '../../../modules/specs/combo/params'
import type { ModuleSpec } from '../../../modules/types'
import type { UiEvent } from '../../protocol'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { Band } from './band'
import { ChromaListener, frameSeconds } from './chroma'
import { BandOutputs } from './coreOutputs'
import { Learner } from './learner'
import { PartBank, styleHints } from './parts'

const HOLD_S = 2

/** COMBO CORE: teach it a part, and the band plays it (see band.ts, learner.ts).
 *  COMBO builds on it with its own sounds and looper (comboDsp.ts). */
export class ComboCoreDsp extends Dsp {
  protected readonly bank: PartBank
  readonly band: Band
  private readonly listener: ChromaListener
  private readonly learner: Learner
  private readonly iIn = this.ii('in')
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iBand = this.ii('band')
  private readonly iNext = this.ii('next')
  private readonly iPart = this.ii('part')
  protected readonly P = {
    genre: this.pi('genre'),
    style: this.pi('style'),
    tempo: this.pi('tempo'),
    alt: this.pi('alt'),
    sbass: this.pi('sbass'),
    count: this.pi('count'),
    part: this.pi('part'),
    run: this.pi('run'),
  }
  private wasPlaying = false
  private booted = false
  /** The band's tempo this sample (learned beats a second). */
  protected rateNow = 0
  /** The band's gates and CV (whichever jacks this module has). */
  private readonly cv: BandOutputs
  private readonly bandIn = new Schmitt()
  private readonly nextIn = new Schmitt()
  private readonly rstIn = new Schmitt()
  private readonly clkIn = new Schmitt()
  private readonly gateWas = new Uint8Array(8)
  private status = 0
  private why = 0
  /** BAND held down, waiting to know if it's a tap (start) or a hold (clear). */
  private pending = false
  private held = 0
  private lastPartCv = -1
  private lastSel = -1
  private readonly knobs = new Float64Array(4).fill(-1)
  /** The panel knobs that act on the selected part, and that part's fields for them. */
  private readonly knobIdx = Int32Array.of(this.P.genre, this.P.style, this.P.alt, this.P.sbass)
  private readonly fieldIdx = new Int32Array(4)
  private clkPeriod = 0
  private sinceClk = 0
  private n32 = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.bank = new PartBank((id) => this.pi(id))
    this.band = new Band(fs)
    this.listener = new ChromaListener(fs)
    this.learner = new Learner(fs, frameSeconds(fs))
    this.cv = new BandOutputs(spec, fs)
  }

  private write = (i: number, v: number): void => this.writeParam(i, v)

  // ---- for the LINK peripherals (FOOTSWITCH, LOOPER) ----

  /** LOOPER presses from a FOOTSWITCH: loopers watch this count. */
  loopPresses = 0

  /** A FOOTSWITCH stomp: BAND, LOOPER (counted for the loopers), PART (the next part). */
  footswitch(name: string, down: boolean): void {
    if (name === 'band') {
      if (down) this.bandDown()
      else this.bandUp()
    } else if (!down) return
    else if (name === 'loop') this.loopPresses++
    else if (name === 'part') this.pressPart(this.band.playing ? this.nextLearned() : (this.sel() + 1) % COMBO_PARTS)
  }

  /** The band's tempo now (bpm), and how long a part is (learned beats; 0 not learned). */
  get bpmNow(): number {
    return this.rateNow * 60
  }
  partBeats(p: number): number {
    return this.bank.parts[p].beats
  }
  /** The part a looper works on: the one playing, else the one selected. */
  loopPart(): number {
    return this.band.playing ? this.band.part : this.sel()
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'button') return
    if (ev.name === 'band') {
      if (ev.down) this.bandDown()
      else this.bandUp()
    } else if (ev.down && ev.name.length === 2 && ev.name[0] === 'p') this.pressPart(Number(ev.name[1]))
  }

  /** BAND goes down: it acts on the press itself, so a part ends exactly on
   *  the downbeat you hit. */
  protected bandDown(): void {
    const sel = this.sel()
    if (this.learner.learning) this.finishLearning()
    else if (this.band.playing) this.band.stop(true)
    else if (!this.bank.learned(sel)) {
      this.learner.start(this.patched[this.iGate] === 1)
      this.status = 1
    } else {
      this.pending = true
      this.held = 0
    }
  }

  protected bandUp(): void {
    if (!this.pending) return
    this.pending = false
    this.startBand(this.sel())
  }

  protected startBand(part: number): void {
    const m = this.bank.parts[part].meter
    this.band.start(part, this.p[this.P.count] >= 0.5, m)
    this.status = 2
  }

  /** A part button: stopped, it selects the part; playing, it cues it (or,
   *  on the part playing, flips its intensity). */
  protected pressPart(i: number): void {
    if (i < 0 || i >= COMBO_PARTS || this.learner.learning) return
    if (this.band.playing) {
      if (i === this.band.part) {
        const h = this.bank.idx[i].f.h
        this.writeParam(h, this.p[h] >= 0.5 ? 0 : 1)
      } else if (this.bank.learned(i)) this.band.cued = i
      else return
    }
    this.writeParam(this.P.part, i)
  }

  protected sel(): number {
    return Math.max(0, Math.min(COMBO_PARTS - 1, Math.round(this.p[this.P.part])))
  }

  private finishLearning(): void {
    const r = this.learner.finish(0)
    const sel = this.sel()
    if (!r.ok) {
      this.status = 3
      this.why = Math.max(0, LEARN_FAILS.indexOf(r.why))
      return
    }
    this.bank.store(sel, r, this.p, this.write)
    // the part takes the panel's genre, style and the rest
    const f = this.bank.idx[sel].f
    this.writeParam(f.g, this.p[this.P.genre])
    this.writeParam(f.s, this.p[this.P.style])
    this.writeParam(f.a, this.p[this.P.alt])
    this.writeParam(f.b, this.p[this.P.sbass])
    this.bank.sync(this.p)
    // the band comes straight in, on the downbeat you just played
    this.band.start(sel, false, r.meter)
    this.status = 2
  }

  /** The panel's knobs show the selected part's settings, and turning them changes it. */
  private syncKnobs(): void {
    const sel = this.sel()
    const f = this.bank.idx[sel].f
    const K = this.knobIdx
    const F = this.fieldIdx
    F[0] = f.g
    F[1] = f.s
    F[2] = f.a
    F[3] = f.b
    if (sel !== this.lastSel) {
      this.lastSel = sel
      for (let k = 0; k < 4; k++) if (this.bank.learned(sel)) this.writeParam(K[k], this.p[F[k]])
    } else for (let k = 0; k < 4; k++) if (this.p[K[k]] !== this.knobs[k] && this.knobs[k] >= 0) this.writeParam(F[k], this.p[K[k]])
    for (let k = 0; k < 4; k++) this.knobs[k] = this.p[K[k]]
  }

  /** One sample of the brain; COMBO calls this, then plays the band itself. */
  protected brain(): void {
    const x = this.in
    if (++this.n32 >= 32) {
      this.n32 = 0
      this.bank.sync(this.p)
      this.syncKnobs()
      // a rack saved with the band playing starts playing again
      if (!this.booted) {
        this.booted = true
        if (this.p[this.P.run] >= 0.5 && this.bank.learned(this.sel())) {
          this.band.start(this.sel(), false, this.bank.parts[this.sel()].meter)
          this.status = 2
          this.wasPlaying = true
        }
      }
    }
    // footswitch gates
    if (this.patched[this.iBand]) {
      if (this.bandIn.rise(x[this.iBand])) this.bandDown()
      else if (!this.bandIn.high && this.pending) this.bandUp()
    }
    if (this.nextIn.rise(x[this.iNext])) this.pressPart(this.nextLearned())
    if (this.patched[this.iPart]) {
      const cv = Math.max(0, Math.min(COMBO_PARTS - 1, Math.floor(x[this.iPart] / 2)))
      if (cv !== this.lastPartCv) {
        this.lastPartCv = cv
        if (this.bank.learned(cv)) this.pressPart(cv)
      }
    }
    if (this.pending && ++this.held > HOLD_S * this.fs) {
      // held: forget the selected part
      this.pending = false
      this.bank.clear(this.sel(), this.p, this.write)
      this.bank.sync(this.p)
    }
    if (this.rstIn.rise(x[this.iRst]) && this.band.playing) this.band.restart()
    // a clock to follow (16ths)
    this.sinceClk++
    if (this.clkIn.rise(x[this.iClk])) {
      if (this.sinceClk < this.fs) this.clkPeriod = this.clkPeriod ? this.clkPeriod + (this.sinceClk - this.clkPeriod) * 0.3 : this.sinceClk
      this.sinceClk = 0
    }
    this.learn()
    const part = this.bank.parts[this.band.part]
    const rate = this.patched[this.iClk] && this.clkPeriod > 0 ? this.fs / (this.clkPeriod * 4) : (part.bpm * (1 + this.p[this.P.tempo] / 100)) / 60
    this.rateNow = rate
    this.band.step(this.bank.parts, this.bank.feels, rate)
    if (!this.band.playing && this.status === 2) this.status = 0
    // the playing state is kept with the rack
    if (this.band.playing !== this.wasPlaying) {
      this.wasPlaying = this.band.playing
      this.writeParam(this.P.run, this.band.playing ? 1 : 0)
    }
    this.cv.write(this.band, this.out, this.polyOut, this.chans)
    this.screen(rate)
  }

  protected nextLearned(): number {
    for (let k = 1; k <= COMBO_PARTS; k++) {
      const i = (this.band.part + k) % COMBO_PARTS
      if (this.bank.learned(i)) return i
    }
    return this.band.part
  }

  private learn(): void {
    const L = this.learner
    if (!L.learning) return
    if (!L.tick()) {
      this.finishLearning()
      return
    }
    if (L.fromCables) {
      const n = Math.max(this.inChans(this.iGate), this.inChans(this.iV))
      for (let c = 0; c < n && c < 8; c++) {
        const g = this.pin(this.iGate, c) > 1
        if (g) L.addNote(this.pin(this.iV, c) * 12, !this.gateWas[c])
        this.gateWas[c] = g ? 1 : 0
      }
      L.endSample(1024)
    } else {
      this.listener.push(this.in[this.iIn])
      const li = this.listener
      if (li.ready) L.addFrame(li.chroma, li.bass, li.flux, li.energy)
    }
  }

  private screen(rate: number): void {
    const L = this.led
    const b = this.band
    const sel = this.sel()
    L[CL.status] = this.learner.learning ? 1 : b.playing ? 2 : this.status === 3 ? 3 : 0
    L[CL.part] = b.part
    L[CL.cued] = b.cued
    L[CL.sel] = sel
    L[CL.beat] = b.pos
    L[CL.beats] = this.bank.parts[b.playing ? b.part : sel].beats
    L[CL.meter] = this.bank.parts[b.playing ? b.part : sel].meter
    L[CL.chord] = b.playing ? b.chord : -1
    L[CL.bpm] = rate * 60
    L[CL.learnT] = this.learner.samples / this.fs
    L[CL.why] = this.why
    for (let i = 0; i < COMBO_PARTS; i++) L[CL.parts + i] = this.bank.learned(i) ? (this.bank.feels[i].hi ? 2 : 1) : 0
    const part = this.bank.parts[sel]
    if (part.beats > 0) styleHints(this.p[this.P.genre], part.meter, this.p[this.bank.idx[sel].f.w] >= 0.5, L, CL.hints)
    else for (let s = 0; s < 12; s++) L[CL.hints + s] = 0
    L[CL.bandLed] = this.learner.learning ? 1 : b.playing ? 0.35 + 0.65 * (1 - (b.pos % 1)) : 0
  }

  tick(): void {
    this.brain()
  }
}
