import { HC_VOICES, HCL } from '../../../modules/specs/halcyon'
import type { ModuleSpec } from '../../../modules/types'
import type { MidiEvent, UiEvent } from '../../protocol'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { KeyVoices } from '../keyVoices'
import { fastTanh } from '../util'
import { HcArp } from './arp'
import { BbdChorus } from './chorus'
import { HcVoice, type HcShared } from './voice'

const RANGE_OCT = [-1, 0, 1]
/** HPF positions 2 and 3 (Hz); 0 boosts the bass, 1 is flat. */
const HPF_HZ = [0, 0, 240, 720]

/** HALCYON: see the spec. Six voices from the keys, the panel's keyboard or
 *  a poly cable, or (ARPEGGIO on) one at a time from the arpeggiator, each
 *  arpeggio note on the next voice so the last one's release rings on; then
 *  the HPF and the chorus. */
export class HalcyonDsp extends Dsp {
  private readonly I = { voct: this.ii('voct'), gate: this.ii('gate'), clk: this.ii('clk'), cutoff: this.ii('cutoff') }
  private readonly O = { l: this.oi('l'), r: this.oi('r'), lfo: this.oi('lfo'), env: this.oi('env') }
  private readonly P = Object.fromEntries(
    ['arp', 'arprate', 'arpmode', 'arprange', 'lrate', 'ldelay', 'range', 'dlfo', 'pwm', 'pwmsrc', 'saw', 'pulse', 'sub', 'noise', 'hpf', 'cutoff', 'res', 'envpol', 'fenv', 'flfo', 'kbd', 'vcamode', 'level', 'a', 'd', 's', 'r', 'chorus', 'vol'].map((id) => [id, this.pi(id)]),
  ) as Record<string, number>
  private readonly keys: KeyVoices
  private readonly voices: HcVoice[] = []
  private readonly arp = new HcArp()
  private readonly chorus: BbdChorus
  private readonly sh: HcShared = { oct: 0, pw: 0.5, pwmEnv: 0, saw: 1, pulse: 1, sub: 0, noise: 0, white: 0, cutoff: 1000, fmod: 0, fenv: 0, kbd: 0, k: 0, a: 0.01, d: 0.5, s: 0.5, r: 0.5, gateMode: false }
  /** Keys held (MIDI, in order) and the HOLD chord. */
  private readonly held = new Int16Array(32)
  private heldN = 0
  private readonly latched = new Int16Array(32)
  private latchedN = 0
  private readonly cable = new Int16Array(HC_VOICES)
  private readonly clkIn = new Schmitt()
  private uiNote = -1
  private wasArp = false
  private arpVoice = 0
  private arpGate = 0
  private clkPeriod = 0
  private sinceClk = 0
  private lfoPh = 0
  private lfoFade = 0
  private hpX = 0
  private hpY = 0
  private shelf = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.keys = new KeyVoices(fs)
    for (let v = 0; v < HC_VOICES; v++) this.voices.push(new HcVoice(fs, this.tol(0.03)))
    this.chorus = new BbdChorus(fs)
    this.clkPeriod = Math.round(fs / 8)
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev, HC_VOICES)
    if (ev.kind === 'on') {
      if (this.heldN === 0) this.latchedN = 0 // a fresh chord replaces the held one
      if (this.heldN < this.held.length) this.held[this.heldN++] = ev.note
      if (this.latchedN < this.latched.length) this.latched[this.latchedN++] = ev.note
    } else if (ev.kind === 'off') {
      let j = 0
      for (let i = 0; i < this.heldN; i++) if (this.held[i] !== ev.note) this.held[j++] = this.held[i]
      this.heldN = j
    } else if (ev.kind === 'panic') this.heldN = this.latchedN = 0
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface' || ev.name !== 'halcyonkeys') return
    if (this.uiNote >= 0) this.onMidi({ kind: 'off', note: this.uiNote })
    this.uiNote = ev.down ? Math.round(ev.x) : -1
    if (ev.down) this.onMidi({ kind: 'on', note: this.uiNote, vel: 100 })
  }

  /** The arpeggiator's chord and its next note onto the next voice. */
  private arpeggiate(hold: boolean): void {
    const p = this.p
    const P = this.P
    if (this.patched[this.I.gate] === 1) {
      let n = 0
      for (let v = 0; v < HC_VOICES; v++) if (this.pin(this.I.gate, v) > 1) this.cable[n++] = Math.round(60 + this.pin(this.I.voct, v) * 12)
      this.arp.setChord(this.cable, n)
    } else if (hold) this.arp.setChord(this.latched, this.latchedN)
    else this.arp.setChord(this.held, this.heldN)
    let clk: boolean | null = null
    this.sinceClk++
    if (this.patched[this.I.clk] === 1) {
      clk = this.clkIn.rise(this.in[this.I.clk])
      if (clk) {
        this.clkPeriod = this.sinceClk
        this.sinceClk = 0
      }
    }
    this.arp.step(p[P.arprate], clk, Math.round(p[P.arpmode]), 1 + Math.round(p[P.arprange]), this.fs)
    if (this.arp.fired) {
      this.voices[this.arpVoice].gate = 0
      this.arpVoice = (this.arpVoice + 1) % HC_VOICES
      const vo = this.voices[this.arpVoice]
      vo.pitch = (this.arp.note - 60) / 12
      vo.note = this.arp.note
      vo.gate = 10
      this.arpGate = Math.round((clk !== null ? this.clkPeriod : this.fs / p[P.arprate]) * 0.5)
    } else if (this.arpGate > 0 && --this.arpGate === 0) this.voices[this.arpVoice].gate = 0
    if (this.arp.count === 0) this.voices[this.arpVoice].gate = 0
  }

  tick(): void {
    const p = this.p
    const P = this.P
    const sh = this.sh
    const arpMode = Math.round(p[P.arp])
    // the notes: arpeggiated, or the keys / a poly cable straight onto the voices
    if (arpMode > 0) {
      if (!this.wasArp) for (let v = 0; v < HC_VOICES; v++) this.voices[v].gate = 0
      this.arpeggiate(arpMode === 2)
    } else {
      const cv = this.patched[this.I.gate] === 1
      for (let v = 0; v < HC_VOICES; v++) {
        const vo = this.voices[v]
        const g = cv ? this.pin(this.I.gate, v) > 1 : this.keys.held(v)
        vo.gate = g ? 10 : 0
        if (g) {
          vo.pitch = cv ? this.pin(this.I.voct, v) : this.keys.pitch[v] + this.in[this.I.voct]
          vo.note = Math.round(60 + vo.pitch * 12)
        }
      }
    }
    this.wasArp = arpMode > 0
    // the LFO fades in over its DELAY once a note starts from silence
    let any = false
    for (let v = 0; v < HC_VOICES; v++) if (this.voices[v].gate > 1) any = true
    this.lfoFade = any ? Math.min(1, this.lfoFade + 1 / (p[P.ldelay] * this.fs)) : 0
    this.lfoPh = (this.lfoPh + p[P.lrate] / this.fs) % 1
    const lfo = (this.lfoPh < 0.5 ? this.lfoPh * 4 - 1 : 3 - this.lfoPh * 4) * this.lfoFade
    // what the voices share
    const src = Math.round(p[P.pwmsrc])
    sh.oct = RANGE_OCT[Math.round(p[P.range])] + p[P.dlfo] * lfo * 0.25
    sh.pw = 0.5 - 0.45 * p[P.pwm] * (src === 0 ? lfo * 0.5 + 0.5 : 1)
    sh.pwmEnv = src === 2 ? p[P.pwm] : 0
    sh.saw = p[P.saw] >= 0.5 ? 1 : 0
    sh.pulse = p[P.pulse] >= 0.5 ? 1 : 0
    sh.sub = p[P.sub]
    sh.noise = p[P.noise]
    sh.white = this.rng.next() * 2 - 1
    sh.cutoff = p[P.cutoff]
    sh.fmod = p[P.flfo] * lfo * 2 + (this.patched[this.I.cutoff] === 1 ? this.in[this.I.cutoff] : 0)
    sh.fenv = p[P.fenv] * (p[P.envpol] >= 0.5 ? -1 : 1)
    sh.kbd = p[P.kbd]
    sh.k = 4 * p[P.res] * 0.98
    sh.a = p[P.a]
    sh.d = p[P.d]
    sh.s = p[P.s]
    sh.r = p[P.r]
    sh.gateMode = p[P.vcamode] >= 0.5
    let x = 0
    let env = 0
    for (let v = 0; v < HC_VOICES; v++) {
      const vo = this.voices[v]
      x += vo.step(sh)
      if (vo.env > env) env = vo.env
      this.led[HCL.voice0 + v] = vo.gate > 1 ? vo.note : -1
    }
    x *= p[P.level]
    // the HPF: 0 a bass boost, 1 flat, 2 and 3 high-passes
    const hpf = Math.round(p[P.hpf])
    if (hpf === 0) {
      this.shelf += (x - this.shelf) * (1 - Math.exp((-2 * Math.PI * 100) / this.fs))
      x += this.shelf
    } else if (hpf > 1) {
      const a = Math.exp((-2 * Math.PI * HPF_HZ[hpf]) / this.fs)
      this.hpY = a * (this.hpY + x - this.hpX)
      this.hpX = x
      x = this.hpY
    }
    this.chorus.run(x, Math.round(p[P.chorus]))
    // the output stage: one voice sits around 2 V, a full chord saturates gently toward 6
    const g = p[P.vol] * 7
    this.out[this.O.l] = fastTanh(this.chorus.l * 2.4) * g
    this.out[this.O.r] = fastTanh(this.chorus.r * 2.4) * g
    this.out[this.O.lfo] = lfo * 5
    this.out[this.O.env] = env * 10
    this.led[HCL.lfo] = lfo * 0.5 + 0.5
    this.led[HCL.arp] = this.arp.fired || this.arpGate > 0 ? 1 : 0
  }
}
