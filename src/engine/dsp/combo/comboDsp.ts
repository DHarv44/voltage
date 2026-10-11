import { GENRES } from '../../../modules/specs/combo/genres'
import { CL, COMBO_PARTS } from '../../../modules/specs/combo/params'
import type { ModuleSpec } from '../../../modules/types'
import type { UiEvent } from '../../protocol'
import { Schmitt } from '../cores'
import { BassVoice } from './bassVoice'
import { ComboCoreDsp } from './coreDsp'
import { DRUM_SLOTS } from './fills'
import { DrumKit } from './kit'
import { L_DUB, L_NONE, L_PLAY, L_REC, PartLooper } from './partLooper'

/** COMBO: COMBO CORE's brain with its own drummer and bass player, a looper
 *  for each part, and your playing passed through, all mixed to L / R. */
export class ComboDsp extends ComboCoreDsp {
  private readonly kit: DrumKit
  private readonly bassVoice: BassVoice
  private readonly looper: PartLooper
  private readonly M = {
    drums: this.pi('drums'),
    bassl: this.pi('bassl'),
    loopl: this.pi('loopl'),
    level: this.pi('level'),
    stretch: this.pi('stretch'),
  }
  private readonly pLt = Array.from({ length: COMBO_PARTS }, (_, i) => this.pi(`lt${i}`))
  private readonly iAudio = this.ii('in')
  private readonly iLoop = this.ii('loop')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly oBand = this.oi('bandout')
  private readonly loopIn = new Schmitt()
  private genre = -1
  private bassWas = false

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.kit = new DrumKit(fs)
    this.bassVoice = new BassVoice(fs)
    this.looper = new PartLooper(fs)
  }

  onUi(ev: UiEvent): void {
    super.onUi(ev)
    if (ev.kind !== 'button' || !ev.down) return
    if (ev.name === 'loop') this.pressLoop()
    else if (ev.name === 'undo' && this.looper.undo(this.loopPart())) this.saveLoop(this.loopPart())
    else if (ev.name === 'clear') {
      const p = this.loopPart()
      this.looper.clear(p)
      this.bufferOut.push({ slot: p, rate: this.fs, data: new Float32Array(0) })
      this.writeParam(this.pLt[p], 0)
    }
  }

  /** The part the looper works on: the one playing, else the one selected. */
  private loopPart(): number {
    return this.band.playing ? this.band.part : this.sel()
  }

  private pressLoop(): void {
    const p = this.loopPart()
    const part = this.bank.parts[p]
    const playing = this.band.playing && part.beats > 0
    const samples = playing ? Math.round((part.beats / Math.max(0.01, this.rateNow)) * this.fs) : 0
    if (this.looper.press(p, samples, this.rateNow * 60)) this.saveLoop(p)
  }

  /** Keep a closed loop with the rack (its audio, and the tempo it was made at). */
  private saveLoop(p: number): void {
    const d = this.looper.data(p)
    if (!d) return
    this.bufferOut.push({ slot: p, rate: this.fs, data: d })
    this.writeParam(this.pLt[p], this.looper.bpm[p])
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot < 0 || slot >= COMBO_PARTS || rate !== this.fs) return
    this.looper.load(slot, data, this.p[this.pLt[slot]])
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    const d = this.looper.data(slot)
    return d ? { rate: this.fs, data: d.slice() } : null
  }

  tick(): void {
    this.brain()
    const b = this.band
    const p = this.p
    // the band's sound follows the genre of the part playing
    const g = Math.round(p[this.bank.idx[b.playing ? b.part : this.sel()].f.g])
    if (g !== this.genre && GENRES[g]) {
      this.genre = g
      this.kit.setGenre(GENRES[g].kit, GENRES[g].perc)
      this.bassVoice.setModel(GENRES[g].bass)
    }
    for (let s = 0; s < DRUM_SLOTS; s++) if (b.hit[s] > 0) this.kit.hit(s, b.hit[s], b.tom)
    if (b.bassOn) this.bassVoice.noteOn(b.bassPitch, b.bassVel)
    else if (this.bassWas && !b.bassGate) this.bassVoice.noteOff()
    this.bassWas = b.bassGate
    const drums = this.kit.step() * p[this.M.drums]
    const bass = this.bassVoice.step() * p[this.M.bassl]
    // the looper: its stomp on a gate too
    if (this.loopIn.rise(this.in[this.iLoop])) this.pressLoop()
    const lp = this.loopPart()
    const part = this.bank.parts[lp]
    const phase = b.playing && part.beats > 0 ? Math.max(0, Math.min(0.999999, b.pos / part.beats)) : -1
    const x = this.in[this.iAudio]
    const loop = this.looper.step(lp, x, phase, this.rateNow * 60, p[this.M.stretch] >= 0.5) * p[this.M.loopl]
    const band = (drums + bass) * 2.5
    const mix = (x + band + loop) * p[this.M.level]
    this.out[this.oL] = mix
    this.out[this.oR] = mix
    this.out[this.oBand] = band
    // the looper's lights
    for (let i = 0; i < COMBO_PARTS; i++) this.led[CL.loops + i] = this.looper.state[i]
    const st = this.looper.state[lp]
    const blink = (b.pos * 2) % 1 < 0.5 ? 1 : 0.25
    this.led[CL.loopLed] = st === L_REC ? 1 : st === L_DUB ? blink : st === L_PLAY ? 0.5 : st === L_NONE ? 0 : 0.15
  }
}
