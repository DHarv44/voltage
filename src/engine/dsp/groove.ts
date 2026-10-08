import { Dsp } from './base'
import { AudioOutCore, Schmitt } from './cores'
import { ClapVoice, HatVoices, KickVoice, SnareVoice } from './drumVoices'
import { DRUM_CHANNEL, type MidiEvent, type UiEvent } from '../protocol'
import { padForNote } from '../drumMap'
import { StepSeqCore, TempoClock, hasStep } from './stepSeq'
import { rails } from './util'

const VOICES = 5 // BD SD CP CH OH; mask row 5 = accent
const LED_DECAY = 0.9993

/** GROOVE-1 drum machine. Trigger sources per voice: its sequencer track
 *  (normalled) or the patched trigger input, plus pads / MIDI ch 10 / keys
 *  at any time. In REC mode, live hits are written into the playing pattern.
 *  It feeds the speakers directly until its MIX output is patched. */
export class GrooveDsp extends Dsp {
  sink = true
  private iClk = this.ii('clk')
  private iRst = this.ii('rst')
  private iTrig = ['t_bd', 't_sd', 't_cp', 't_ch', 't_oh'].map((id) => this.ii(id))
  private iAcc = this.ii('acc')
  private O = { bd: this.oi('bd'), sd: this.oi('sd'), cp: this.oi('cp'), hh: this.oi('hh'), mix: this.oi('mix'), clk: this.oi('clk'), acc: this.oi('acc') }
  private P = {
    bdTune: this.pi('bd_tune'), bdDecay: this.pi('bd_decay'), sdTune: this.pi('sd_tune'), sdSnap: this.pi('sd_snap'),
    cpTone: this.pi('cp_tone'), cpDecay: this.pi('cp_decay'), hhMetal: this.pi('hh_metal'), chDecay: this.pi('ch_decay'),
    hhTone: this.pi('hh_tone'), ohDecay: this.pi('oh_decay'), tempo: this.pi('tempo'), swing: this.pi('swing'),
    len: this.pi('len'), accent: this.pi('accent'), vol: this.pi('vol'), run: this.pi('run'), rec: this.pi('rec'), pat: this.pi('pat'),
  }
  private pA = Array.from({ length: VOICES + 1 }, (_, t) => this.pi(`a${t}`))
  private pB = Array.from({ length: VOICES + 1 }, (_, t) => this.pi(`b${t}`))

  private readonly kick = new KickVoice(this.fs)
  private readonly snare = new SnareVoice(this.fs, this.rng)
  private readonly clap = new ClapVoice(this.fs, this.rng)
  private readonly hats = new HatVoices(this.fs, this.rng)
  private readonly audio = new AudioOutCore(this.fs)
  private readonly seq = new StepSeqCore(this.fs)
  private readonly tempo = new TempoClock(this.fs)
  private readonly clkIn = new Schmitt()
  private readonly rstIn = new Schmitt()
  private readonly trigIn = Array.from({ length: VOICES }, () => new Schmitt())
  private readonly skip = new Int32Array(VOICES).fill(-1)
  private readonly ttol = this.tol(0.02)
  private playing = 0
  private lastFired = -1
  private wasRunning = false
  private rstOut = 0
  private readonly oRst = this.oi('rsto')
  private accPulse = 0
  /** Live hits arrive between audio blocks; they're played on the next sample. */
  private queued: { voice: number; level: number }[] = []

  private masks(pattern: number): number[] {
    return pattern === 1 ? this.pB : this.pA
  }

  private hit(voice: number, level: number): void {
    switch (voice) {
      case 0: this.kick.trigger(level); break
      case 1: this.snare.trigger(level); break
      case 2: this.clap.trigger(level); break
      case 3: this.hats.triggerClosed(level); break
      case 4: this.hats.triggerOpen(level); break
    }
    this.led[2 + voice] = 1
  }

  /** A live (pad/MIDI/key) hit: sound it, and record it if REC is on and running. */
  private live(voice: number, vel: number): void {
    if (voice < 0 || voice >= VOICES) return
    this.queued.push({ voice, level: 0.35 + 0.65 * (vel / 127) })
    if (this.p[this.P.rec] >= 0.5 && this.p[this.P.run] >= 0.5) {
      const len = Math.max(1, Math.round(this.p[this.P.len]))
      const s = this.seq.nearestStep(len)
      const idx = this.masks(this.playing)[voice]
      this.writeParam(idx, this.p[idx] | (1 << s))
      if (s !== this.seq.step) this.skip[voice] = s
    }
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'pad' && ev.down) this.live(ev.index, ev.vel)
    else if (ev.kind === 'button' && ev.name === 'clear' && ev.down) {
      const pat = Math.round(this.p[this.P.pat])
      for (const idx of this.masks(pat >= 2 ? this.playing : pat)) this.writeParam(idx, 0)
    }
  }

  onMidi(ev: MidiEvent): void {
    if (ev.kind === 'on' && ev.ch === DRUM_CHANNEL) this.live(padForNote(ev.note), ev.vel)
  }

  tick(): void {
    const { P, O } = this
    const i = this.in
    const p = this.p
    const len = Math.max(1, Math.round(p[P.len]))
    const pat = Math.round(p[P.pat])
    if (pat < 2) this.playing = pat
    const running = p[P.run] >= 0.5

    // Start from the top whenever RUN is switched on, or on a reset edge.
    if ((running && !this.wasRunning) || this.rstIn.rise(i[this.iRst])) {
      this.seq.reset()
      this.tempo.reset()
      this.lastFired = -1
      if (pat === 2) this.playing = 0
      this.rstOut = Math.round(0.003 * this.fs) // followers start over too
    }
    this.wasRunning = running
    this.out[this.oRst] = this.rstOut > 0 ? 10 : 0
    if (this.rstOut > 0) this.rstOut--

    const external = this.patched[this.iClk] === 1
    const extEdge = this.clkIn.rise(i[this.iClk])
    const edge = running && (external ? extEdge : this.tempo.tick(p[P.tempo]))
    const fire = this.seq.tick(edge, len, p[P.swing])

    const accentLevel = Math.min(1, 0.65 + 0.6 * p[P.accent])
    if (fire >= 0) {
      if (pat === 2 && fire === 0 && this.lastFired >= 0) this.playing ^= 1
      this.lastFired = fire
      const m = this.masks(this.playing)
      const accented = hasStep(p[m[VOICES]], fire)
      if (accented) this.accPulse = Math.round(0.005 * this.fs)
      for (let v = 0; v < VOICES; v++) {
        if (this.patched[this.iTrig[v]]) continue // external trigger owns this voice
        if (this.skip[v] === fire) {
          this.skip[v] = -1
          continue
        }
        if (hasStep(p[m[v]], fire)) this.hit(v, accented ? accentLevel : 0.65)
      }
    }

    const extAcc = this.patched[this.iAcc] ? i[this.iAcc] > 1.2 : false
    for (let v = 0; v < VOICES; v++)
      if (this.trigIn[v].rise(i[this.iTrig[v]]) && this.patched[this.iTrig[v]]) this.hit(v, extAcc ? accentLevel : 0.65)
    if (this.queued.length) {
      for (const q of this.queued) this.hit(q.voice, q.level)
      this.queued.length = 0
    }

    // Voices
    const bd = this.kick.step(p[P.bdTune] * this.ttol, p[P.bdDecay], 0.5, 0.25)
    const sd = this.snare.step(p[P.sdTune] * this.ttol, 0.4, p[P.sdSnap], 0.18)
    const cp = this.clap.step(p[P.cpTone], p[P.cpDecay], 0.009)
    this.hats.step(p[P.hhMetal], p[P.chDecay], p[P.ohDecay], p[P.hhTone])
    const hh = this.hats.ch + this.hats.oh

    const o = this.out
    o[O.bd] = 5 * bd
    o[O.sd] = 5 * sd
    o[O.cp] = 5 * cp
    o[O.hh] = 5 * hh
    const mix = rails(5 * (bd + 0.8 * sd + 0.7 * cp + 0.55 * hh))
    o[O.mix] = mix
    o[O.clk] = running && (external ? i[this.iClk] > 1.2 : this.tempo.high) ? 10 : 0
    o[O.acc] = this.accPulse > 0 ? 10 : 0
    if (this.accPulse > 0) this.accPulse--

    // switched direct out: the speakers until MIX is patched somewhere
    const s = this.audio.process(mix, p[P.vol])
    this.audioL = this.audioR = this.outPatched[O.mix] ? 0 : s

    this.led[0] = running ? this.seq.step : -1
    this.led[1] = this.playing
    for (let v = 0; v < VOICES; v++) this.led[2 + v] *= LED_DECAY
    this.led[7] = p[P.rec] >= 0.5 ? 1 : 0
    this.led[8] = running && this.seq.step % 4 === 0 ? 1 : 0
  }
}
