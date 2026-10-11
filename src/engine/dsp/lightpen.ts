import { LP_ROWS, LP_SCALE_STEPS, LP_STEPS, LPL } from '../../modules/specs/lightpen'
import type { ModuleSpec } from '../../modules/types'
import type { MidiEvent, UiEvent } from '../protocol'
import { Biquad } from './biquad'
import { Dsp, MAX_VOICES } from './base'
import { Schmitt } from './cores'
import { KeyVoices } from './keyVoices'
import { PocketClock } from './pocketClock'
import { ERAS, quantise } from './sampling/converter'
import { FACTORY_NAMES, makeFactory, type FactorySample } from './sampling/factory'
import { LowpassSvf } from './sampling/svf'
import { LOOP_FWD, LOOP_OFF, SampleVoice, type SampleData } from './sampling/voice'

const VOICES = 8
const MAX_REC_S = 12
/** The rate the factory sounds are made at (the era's converter does the rest). */
const FACTORY_RATE = 32000

/** LIGHTPEN: see the spec. Voices 0–7 play the keys or a poly cable; the
 *  grid takes free voices of its own (round the pool, oldest first). */
export class LightpenDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly iIn = this.ii('in')
  private readonly iRec = this.ii('rec')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly P = {
    sound: this.pi('sound'),
    era: this.pi('era'),
    tune: this.pi('tune'),
    cutoff: this.pi('cutoff'),
    res: this.pi('res'),
    att: this.pi('att'),
    rel: this.pi('rel'),
    level: this.pi('level'),
    loop: this.pi('loop'),
    tempo: this.pi('tempo'),
    key: this.pi('key'),
    scale: this.pi('scale'),
    oct: this.pi('oct'),
    seq: this.pi('seq'),
    g0: this.pi('g0'),
  }
  private readonly voices: SampleVoice[]
  private readonly keys: KeyVoices
  private readonly clock: PocketClock
  private readonly recIn = new Schmitt()
  private readonly lp: LowpassSvf
  private readonly recon: Biquad
  private readonly factory: (FactorySample | null)[] = FACTORY_NAMES.map(() => null)
  private readonly user: SampleData
  private soundNow = -1
  private eraNow = -1
  private sample: (SampleData & { root: number; loopStart: number; loopEnd: number }) | null = null
  private recording = false
  /** Per voice: the gate it was last given (a rising edge starts it), and which row of the grid holds it (−1: keys / cable). */
  private readonly was = new Uint8Array(MAX_VOICES)
  private readonly row = new Int8Array(VOICES).fill(-1)
  private step = -1

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.voices = Array.from({ length: VOICES }, () => new SampleVoice(fs))
    this.keys = new KeyVoices(fs)
    this.clock = new PocketClock(LP_STEPS, fs)
    this.lp = new LowpassSvf(fs)
    this.recon = new Biquad(fs)
    this.user = { data: new Float32Array(Math.round(MAX_REC_S * fs)), len: 0, rate: fs }
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev, VOICES)
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'button' && ev.name === 'rec' && ev.down) this.toggleRec()
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot !== 0) return
    const n = Math.min(this.user.data.length, data.length)
    this.user.data.set(data.subarray(0, n))
    this.user.len = n
    this.user.rate = rate
    this.soundNow = -1
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    return slot === 0 && this.user.len ? { rate: this.user.rate, data: this.user.data.slice(0, this.user.len) } : null
  }

  private toggleRec(): void {
    if (this.recording) {
      this.recording = false
      this.bufferOut.push({ slot: 0, rate: this.user.rate, data: this.user.data.subarray(0, this.user.len) })
      this.writeParam(this.P.sound, FACTORY_NAMES.length) // play what was just recorded
      this.soundNow = -1
    } else {
      this.recording = true
      this.user.len = 0
      this.user.rate = this.fs
    }
  }

  /** The sound to play (a factory one is made the first time it's chosen). */
  private pick(): void {
    const s = Math.round(this.p[this.P.sound])
    const e = Math.round(this.p[this.P.era])
    if (s === this.soundNow && e === this.eraNow) return
    this.soundNow = s
    if (e !== this.eraNow) {
      this.eraNow = e
      const era = ERAS[e] ?? ERAS[1]
      this.recon.lowpass(era.recon > 0 ? era.recon : this.fs * 0.49, 0.7)
    }
    if (s >= FACTORY_NAMES.length) this.sample = this.user.len ? { ...this.user, root: 60, loopStart: 0, loopEnd: 0 } : null
    else {
      this.factory[s] ??= makeFactory(s, FACTORY_RATE)
      this.sample = this.factory[s]
    }
  }

  /** Start voice v on MIDI-ish note `semis` (60 = C4) at velocity `vel`. */
  private start(v: number, semis: number, vel: number): void {
    const s = this.sample
    if (!s) return
    const vo = this.voices[v]
    const looped = this.p[this.P.loop] >= 0.5 && s.loopEnd > s.loopStart
    vo.loop = looped ? LOOP_FWD : LOOP_OFF
    vo.loopStart = looped ? s.loopStart : 0
    vo.loopEnd = looped ? s.loopEnd : 0
    vo.variable = true
    vo.attack = this.p[this.P.att]
    vo.release = this.p[this.P.rel]
    vo.trigger(s, 0, s.len, Math.pow(2, (semis - s.root + this.p[this.P.tune]) / 12), 0.35 + 0.65 * vel)
  }

  /** A free voice for the grid (none playing, else the one that started longest ago). */
  private freeVoice(): number {
    let best = 0
    let age = -1
    for (let v = 0; v < VOICES; v++) {
      if (!this.voices[v].active) return v
      if (this.row[v] >= 0 && this.voices[v].age > age) (age = this.voices[v].age), (best = v)
    }
    return best
  }

  /** The grid's next step: rows that start here start; rows that stop here let go. */
  private advance(): void {
    this.step = (this.step + 1) % LP_STEPS
    const now = Math.round(this.p[this.P.g0 + this.step])
    const before = Math.round(this.p[this.P.g0 + ((this.step + LP_STEPS - 1) % LP_STEPS)])
    const scale = LP_SCALE_STEPS[Math.round(this.p[this.P.scale])] ?? LP_SCALE_STEPS[0]
    const base = 60 + Math.round(this.p[this.P.key]) + 12 * Math.round(this.p[this.P.oct])
    for (let r = 0; r < LP_ROWS; r++) {
      const bit = 1 << r
      const on = (now & bit) !== 0
      const held = (before & bit) !== 0
      if (held && !on)
        for (let v = 0; v < VOICES; v++)
          if (this.row[v] === r) {
            this.voices[v].noteOff()
            this.row[v] = -1
          }
      if (on && !held) {
        const v = this.freeVoice()
        this.row[v] = r
        this.start(v, base + scale[r], 0.8)
      }
    }
  }

  tick(): void {
    const p = this.p
    this.pick()
    if (this.recIn.rise(this.in[this.iRec])) this.toggleRec()
    if (this.recording) {
      this.user.data[this.user.len++] = this.in[this.iIn] / 5
      if (this.user.len >= this.user.data.length) this.toggleRec()
    }
    // the grid, on its own tempo or CLK
    const playing = p[this.P.seq] >= 0.5
    const c = this.clock
    const stepped = c.tick(playing, this.patched[this.iClk] === 1, this.in[this.iClk], p[this.P.tempo], 0, this.in[this.iRst])
    if (c.restarted || !playing) {
      // stopping (or starting over) lets the grid's notes go
      for (let v = 0; v < VOICES; v++)
        if (this.row[v] >= 0) {
          this.voices[v].noteOff()
          this.row[v] = -1
        }
      this.step = -1
    }
    if (stepped) this.advance()
    // the keys or a poly cable, on the voices the grid isn't holding
    const cvGate = this.patched[this.iGate] === 1
    for (let v = 0; v < VOICES; v++) {
      if (this.row[v] >= 0) continue
      const g = cvGate ? this.pin(this.iGate, v) > 1 : this.keys.held(v)
      if (g && !this.was[v]) this.start(v, 60 + (cvGate ? this.pin(this.iV, v) : this.keys.pitch[v] + this.in[this.iV]) * 12, cvGate ? 0.8 : this.keys.vel[v])
      else if (!g && this.was[v]) this.voices[v].noteOff()
      this.was[v] = g ? 1 : 0
    }
    // each voice through its own DAC (the era's bits), then the filter
    const era = ERAS[this.eraNow] ?? ERAS[1]
    let l = 0
    let r = 0
    for (let v = 0; v < VOICES; v++) {
      const vo = this.voices[v]
      if (!vo.active) continue
      const y = quantise(Math.max(-1, Math.min(1, vo.step())), era.bits, era.companded)
      l += y * (1 - v * 0.06)
      r += y * (0.58 + v * 0.06)
    }
    this.lp.set(p[this.P.cutoff], p[this.P.res])
    const mono = this.recon.run(this.lp.run((l + r) * 0.5))
    const side = (l - r) * 0.25
    // the output stage: a gentle analog saturation up to about ±6 V
    const gain = p[this.P.level] * 6
    this.out[this.oL] = Math.tanh((mono + side) * 2.5) * gain
    this.out[this.oR] = Math.tanh((mono - side) * 2.5) * gain
    this.led[LPL.step] = this.step
    this.led[LPL.rec] = this.recording ? 1 : 0
    this.led[LPL.fill] = this.recording ? this.user.len / this.user.data.length : 0
  }
}
