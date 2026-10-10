import { CL, COMBO_PARTS, LEARN_FAILS } from '../../../modules/specs/combo/params'
import { chordQuality, chordRoot } from '../../../modules/specs/combo/chords'
import type { ModuleSpec } from '../../../modules/types'
import type { UiEvent } from '../../protocol'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { Band, GATE_SLOTS } from './band'
import { ChromaListener, frameSeconds } from './chroma'
import { Learner } from './learner'
import { PartBank, styleHints } from './parts'

const HOLD_S = 2
const PULSE_S = 0.005
const out = (spec: ModuleSpec, id: string) => spec.outputs.findIndex((j) => j.id === id)

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
  // outputs (COMBO has only some of them: −1 when absent)
  private readonly oGates = ['kick', 'snare', 'hat', 'ohat', 'ride', 'tom', 'perc', 'crash'].map((id) => out(this.spec, id))
  private readonly oAcc = out(this.spec, 'acc')
  private readonly oBass = out(this.spec, 'bass')
  private readonly oBgate = out(this.spec, 'bgate')
  private readonly oChord = out(this.spec, 'chord')
  private readonly oRoot = out(this.spec, 'root')
  private readonly oClk = out(this.spec, 'clko')
  private readonly oRst = out(this.spec, 'rsto')
  private readonly gateT = new Int32Array(10)
  private readonly pulse: number
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
    this.pulse = Math.round(PULSE_S * fs)
  }

  private write = (i: number, v: number): void => this.writeParam(i, v)

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

  private sel(): number {
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
    this.band.step(this.bank.parts, this.bank.feels, rate)
    if (!this.band.playing && this.status === 2) this.status = 0
    // the playing state is kept with the rack
    if (this.band.playing !== this.wasPlaying) {
      this.wasPlaying = this.band.playing
      this.writeParam(this.P.run, this.band.playing ? 1 : 0)
    }
    this.outputs(rate)
  }

  private nextLearned(): number {
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

  private outputs(rate: number): void {
    const o = this.out
    const b = this.band
    for (let k = 0; k < 8; k++) {
      if (b.hit[GATE_SLOTS[k]] > 0) this.gateT[k] = this.pulse
      if (this.oGates[k] >= 0) o[this.oGates[k]] = this.gateT[k] > 0 ? 10 : 0
      if (this.gateT[k] > 0) this.gateT[k]--
    }
    let acc = false
    for (let k = 0; k < 8; k++) if (b.hit[GATE_SLOTS[k]] >= 0.9) acc = true
    if (acc) this.gateT[8] = this.pulse
    if (this.oAcc >= 0) o[this.oAcc] = this.gateT[8] > 0 ? 10 : 0
    if (this.gateT[8] > 0) this.gateT[8]--
    if (b.tick16 || b.partStart) this.gateT[9] = this.pulse
    if (this.oBass >= 0) o[this.oBass] = (b.bassPitch - 60) / 12
    if (this.oBgate >= 0) o[this.oBgate] = b.bassGate ? 10 : 0
    if (this.oClk >= 0) o[this.oClk] = b.tick16 || this.gateT[9] > 0 ? 10 : 0
    if (this.oRst >= 0) o[this.oRst] = b.partStart ? 10 : 0
    if (this.gateT[9] > 0) this.gateT[9]--
    if (this.oChord >= 0) {
      const c = b.chord
      const tones = c >= 0 ? chordQuality(c).tones : null
      const root = c >= 0 ? 48 + chordRoot(c) : 48
      const n = tones ? tones.length : 1
      for (let k = 0; k < n; k++) this.pout(this.oChord, k, tones ? (root + tones[k] - 60) / 12 : 0)
      this.chans[this.oChord] = n
      if (this.oRoot >= 0) o[this.oRoot] = (root - 60) / 12
    }
    this.screen(rate)
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
