import type { ModuleSpec } from '../../../modules/types'
import { ARP, DRUM, SB_ARP_MAX, SB_BALLS, SB_DRUMS, SB_STEPS, SB_TRACKS, SB_VOICES, SBL, TUMBLE } from '../../../modules/specs/sketchbook'
import type { MidiEvent, UiEvent } from '../../protocol'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { PocketClock } from '../pocketClock'
import { Tape } from './tape'
import { render } from './engines'
import { SketchDrums } from './drums'
import { SketchFx, SketchLfo } from './fx'
import { SketchSeq, type Player } from './seq'
import { Voice } from './voice'

/** TUMBLE's drum moves every CTRL samples. */
const CTRL = 16
const TAU = Math.PI * 2

/** SKETCHBOOK (see the spec): six voices on the selected engine, played from
 *  its keybed, the computer keyboard / MIDI, V/OCT+GATE, or its sequencer;
 *  everything you hear can go onto the 4-track loop tape. */
export class SketchbookDsp extends Dsp implements Player {
  private readonly iClk = this.ii('clk')
  private readonly iVoct = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iAudio = this.ii('audio')
  private readonly p0 = {
    engine: this.pi('engine'), oct: this.pi('oct'), k: this.pi('k0_0'),
    a: this.pi('a'), d: this.pi('d'), s: this.pi('s'), r: this.pi('r'),
    tempo: this.pi('tempo'), len: this.pi('len'), swing: this.pi('swing'), glen: this.pi('glen'), n: this.pi('n0'),
    run: this.pi('run'), bars: this.pi('bars'), trk: this.pi('trk'), drive: this.pi('drive'), vol: this.pi('vol'),
    lv: this.pi('lv0'), master: this.pi('master'),
    fx: this.pi('fx'), fxmix: this.pi('fxmix'), fxa: this.pi('fxa'), fxb: this.pi('fxb'),
    lfo: this.pi('lfo'), lrate: this.pi('lrate'), ldepth: this.pi('ldepth'), ldest: this.pi('ldest'),
    stype: this.pi('stype'), arate: this.pi('arate'), aoct: this.pi('aoct'), amode: this.pi('amode'),
    tspin: this.pi('tspin'), tgrav: this.pi('tgrav'), tballs: this.pi('tballs'), dchange: this.pi('dchange'),
    mode: this.pi('mode'), dk: this.pi('d0_0'), dm: this.pi('dm0'),
    tspd: this.pi('tspd'), tin: this.pi('tin'), tout: this.pi('tout'), twow: this.pi('twow'),
  }
  /** K1–K4: CV onto the sound's four knobs (consecutive inputs). */
  private readonly iK = this.ii('k1')
  /** T1–T4 (consecutive outputs). */
  private readonly oT = this.oi('t1')
  private readonly seq: SketchSeq
  private readonly drums: SketchDrums
  private drumStep = -1
  private readonly fx: SketchFx
  private readonly lfo = new SketchLfo()
  private readonly voices: Voice[]
  private readonly clock: PocketClock
  private readonly tape: Tape
  private readonly gateIn = new Schmitt()
  private readonly knobs = new Float64Array(4)
  private readonly trackOut = new Float32Array(SB_TRACKS)
  private wasRunning = false
  private born = 0
  private extVolts = 0
  private lastVolts = 0
  private livePeak = 0
  private n = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.voices = Array.from({ length: SB_VOICES }, () => new Voice(fs, this.rng))
    this.clock = new PocketClock(SB_STEPS, fs)
    this.tape = new Tape(fs)
    this.fx = new SketchFx(fs)
    this.seq = new SketchSeq(this.rng, this)
    this.drums = new SketchDrums(fs, this.rng)
  }

  /** The sequencer plays through here (Player). */
  play(volts: number, vel: number, hold: number): void {
    this.noteOn(volts, vel, hold)
  }

  /** Start a note on a free voice (or the oldest). `hold`: samples until it
   *  lets go by itself (−1: until noteOff). */
  private noteOn(volts: number, vel: number, hold: number): void {
    let v = this.voices[0]
    for (const x of this.voices) {
      if (!x.sounding) {
        v = x
        break
      }
      if (x.born < v.born) v = x
    }
    this.loadKnobs()
    v.start(volts, vel, hold, this.born++, this.knobs, this.fs)
    this.lastVolts = volts
  }

  private noteOff(volts: number): void {
    for (const v of this.voices) if (v.gate > 0 && v.hold < 0 && Math.abs(v.volts - volts) < 1e-6) v.gate = 0
  }

  /** Keybed key / pattern note → volts: 25 keys from C3 at OCTAVE 0 (Player). */
  volts(key: number): number {
    return (key + 12 * Math.round(this.p[this.p0.oct]) - 12) / 12
  }

  /** A key played (keybed, computer keys, MIDI): straight to a voice, or,
   *  with the ARP sequencer, into the arpeggio. */
  private key(volts: number, down: boolean, vel: number): void {
    if (Math.round(this.p[this.p0.mode]) === DRUM) {
      // DRUM mode: the keys are the kit (C = KICK, C# = SNARE …, repeating)
      const semis = Math.round(volts * 12 - 12 * Math.round(this.p[this.p0.oct]) + 12)
      if (down) this.drums.trigger(((semis % SB_DRUMS.length) + SB_DRUMS.length) % SB_DRUMS.length, Math.max(0.3, vel))
      return
    }
    if (Math.round(this.p[this.p0.stype]) === ARP) this.seq.hold(volts, down)
    else if (down) this.noteOn(volts, vel, -1)
    else this.noteOff(volts)
  }

  /** The sound's four knobs, with K1–K4 CV on top (±5 V = ± half their travel). */
  private loadKnobs(): void {
    const base = this.p0.k + Math.round(this.p[this.p0.engine]) * 4
    for (let i = 0; i < 4; i++) this.knobs[i] = Math.min(1, Math.max(0, this.p[base + i] + this.in[this.iK + i] / 10))
  }

  /** Saved tape tracks coming back (a reload, undo). */
  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    const t = this.tape.tracks[slot]
    if (!t || rate !== this.fs) return
    const n = Math.min(t.length, data.length)
    t.set(data.subarray(0, n))
    this.tape.ends[slot] = n
  }

  /** A track for "Export audio (WAV)". */
  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    const t = this.tape.tracks[slot]
    const n = this.tape.ends[slot] ?? 0
    return t && n ? { rate: this.fs, data: t.slice(0, n) } : null
  }

  onMidi(ev: MidiEvent): void {
    if (ev.kind === 'on') this.key((ev.note - 60) / 12, true, ev.vel / 127)
    else if (ev.kind === 'off') this.key((ev.note - 60) / 12, false, 0)
    else if (ev.kind === 'panic') {
      for (const v of this.voices) v.gate = 0
      this.seq.heldCount = 0
    }
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'key') this.key(this.volts(Math.round(ev.x)), ev.down, 0.9)
    else if (ev.name === 'kick' && ev.down) this.seq.drum.kick(Math.round(this.p[this.p0.tballs]))
    else if (ev.name === 'rec' && ev.down) this.tape.recording = !this.tape.recording
    else if (ev.name === 'clear' && ev.down) this.tape.clear(Math.round(ev.x))
    else if (ev.name === 'lift' && ev.down) this.tape.lift(Math.round(ev.x), this.p[this.p0.tin], this.p[this.p0.tout])
    else if (ev.name === 'drop' && ev.down) this.tape.drop(Math.round(ev.x))
  }

  tick(): void {
    const p = this.p
    const q = this.p0
    const fs = this.fs
    const running = p[q.run] >= 0.5
    if (running && !this.wasRunning) {
      this.tape.rewind(p[q.tin], p[q.tout], p[q.tspd])
      this.seq.step = -1
      this.drumStep = -1
    }
    this.wasRunning = running
    const c = this.clock
    const seq = this.seq
    const type = Math.round(p[q.stype])
    const len = Math.max(1, Math.round(p[q.len]))
    const clocked = this.patched[this.iClk] === 1
    // PATTERN / DRIFT: one step per 16th (or per CLK edge)
    if (c.tick(running, clocked, this.in[this.iClk], p[q.tempo], p[q.swing])) {
      seq.onStep(type, p, q.n, len, p[q.glen], p[q.dchange], c.stepLen, fs)
      // the drums have their own 16 steps per sound
      this.drumStep = (this.drumStep + 1) % SB_STEPS
      for (let s = 0; s < SB_DRUMS.length; s++) if ((p[q.dm + s] >> this.drumStep) & 1) this.drums.trigger(s, 0.9)
    }
    // ARP plays whenever keys are held, on the tempo's grid
    if (type === ARP) seq.arpTick(Math.round(p[q.arate]), Math.round(p[q.aoct]), Math.round(p[q.amode]), clocked ? c.stepLen : 15 / p[q.tempo], fs)
    // TUMBLE: the drum turns while the transport runs; its walls are the first steps
    if (type === TUMBLE && running && this.n % CTRL === 0)
      seq.tumbleTick(CTRL / fs, p, q.n, Math.min(8, Math.max(3, len)), p[q.tspin], p[q.tgrav], Math.round(p[q.tballs]), Math.round(p[q.glen] * 0.25 * fs))
    // V/OCT + GATE from the rack
    const g = this.in[this.iGate]
    const wasHigh = this.gateIn.high
    if (this.gateIn.rise(g)) {
      this.extVolts = this.in[this.iVoct]
      this.noteOn(this.extVolts, 1, -1)
    } else if (wasHigh && !this.gateIn.high) this.noteOff(this.extVolts)

    // the LFO: vibrato, a knob swept, or tremolo
    const depth = p[q.ldepth]
    const lfo = depth > 0 ? this.lfo.step(Math.round(p[q.lfo]), p[q.lrate], fs) * depth : 0
    const dest = Math.round(p[q.ldest])
    this.loadKnobs()
    if (dest === 1) this.knobs[0] = Math.min(1, Math.max(0, this.knobs[0] + lfo * 0.5))
    else if (dest === 2) this.knobs[2] = Math.min(1, Math.max(0, this.knobs[2] + lfo * 0.5))
    const bend = dest === 0 ? (lfo * 2) / 12 : 0

    // the voices, on the selected engine
    const engine = Math.round(p[q.engine])
    let mix = 0
    let gates = 0
    let sounding = 0
    for (const v of this.voices) {
      if (v.hold > 0 && --v.hold === 0) v.gate = 0
      if (!v.sounding) continue
      sounding++
      if (v.gate > 0) gates++
      const e = v.env.step(v.gate, v.age === 0, p[q.a], p[q.d], p[q.s], p[q.r])
      mix += render(v, engine, this.knobs, e, fs, bend) * e * v.vel
    }
    let synth = Math.tanh(mix * 0.9) * p[q.vol]
    if (dest === 3) synth *= 1 - depth * 0.5 + lfo * 0.5

    // the sound's effect (stereo), then the tape (loop length follows the
    // tempo; it records the effected sound and AUDIO in), then the mix
    const fx = this.fx
    fx.process(synth, Math.round(p[q.fx]), p[q.fxmix], p[q.fxa], p[q.fxb], c.stepLen)
    const tp = this.tape
    if ((this.n++ & 63) === 0) tp.setLength(Math.round(p[q.bars]), c.stepLen)
    const audio = this.patched[this.iAudio] ? this.in[this.iAudio] / 5 : 0
    const drums = this.drums.step(p, q.dk) * 0.45 // the kit sits under the synth, not on top of it
    const trk = Math.round(p[q.trk])
    tp.step((fx.l[0] + fx.r[0]) * 0.5 + drums + audio, running, trk, p[q.drive], p[q.tspd], p[q.tin], p[q.tout], p[q.twow], this.trackOut)
    const o = this.out
    let tape = audio + drums
    for (let t = 0; t < SB_TRACKS; t++) {
      const y = this.trackOut[t] * p[q.lv + t]
      tape += y
      o[this.oT + t] = y * 5
      // a track that changed goes to the rack to be kept with the patch
      if (tp.changed[t]) {
        tp.changed[t] = 0
        this.bufferOut.push({ slot: t, rate: fs, data: tp.tracks[t].subarray(0, tp.ends[t]) })
      }
    }
    const gain = p[q.master] * 2

    o[0] = c.clkSample()
    o[1] = this.lastVolts
    o[2] = gates > 0 ? 10 : 0
    o[3] = Math.tanh((fx.l[0] + tape) * gain) * 5
    o[4] = Math.tanh((fx.r[0] + tape) * gain) * 5

    const a = Math.abs(synth)
    this.livePeak = a > this.livePeak ? a : this.livePeak * 0.99995
    const led = this.led
    led[SBL.step] = seq.step
    if ((this.n & 255) === 0) {
      // the sequencer's own state for the screen: drum, drift, arpeggio
      led[SBL.angle] = seq.drum.angle / TAU
      for (let i = 0; i < SB_BALLS; i++) {
        const b = seq.drum.balls[i]
        led[SBL.balls + i * 2] = i < Math.round(p[q.tballs]) ? (b.x + 1) / 2 : -1
        led[SBL.balls + i * 2 + 1] = (b.y + 1) / 2
      }
      for (let i = 0; i < SB_STEPS; i++) led[SBL.drift + i] = seq.drift[i]
      led[SBL.dstep] = this.drumStep
      for (let s = 0; s < SB_DRUMS.length; s++) led[SBL.dflash + s] = this.drums.flash[s]
      led[SBL.arpCount] = seq.heldCount
      for (let i = 0; i < SB_ARP_MAX; i++) led[SBL.arp + i] = Math.round(seq.held[i] * 12)
    }
    led[SBL.pos] = this.tape.pos / this.tape.len
    led[SBL.rec] = this.tape.recording ? 1 : 0
    led[SBL.run] = running ? 1 : 0
    for (let t = 0; t < SB_TRACKS; t++) led[SBL.peak + t] = this.tape.peak[t]
    led[SBL.live] = this.livePeak
    led[SBL.note] = Math.round(this.lastVolts * 12)
    led[SBL.voices] = sounding
  }
}
