import { ZN_EVERY, ZN_VOICES, ZNL } from '../../../modules/specs/zones'
import type { ModuleSpec } from '../../../modules/types'
import type { MidiEvent, UiEvent } from '../../protocol'
import { Dsp, MAX_VOICES } from '../base'
import { KeyVoices } from '../keyVoices'
import { layerFor, rootFor, takeAt, tinePiano, type MultiSample } from '../sampling/multi'
import { LowpassSvf } from '../sampling/svf'
import { SampleVoice } from '../sampling/voice'
import { AutoSampler } from './autoSampler'

/** Velocity for notes from a cable with nothing in VEL. */
const CABLE_VEL = 0.7

/** ZONES: see the spec. Eight voices from the keys or a poly cable, each
 *  playing the take its note and velocity pick (taking turns over the round
 *  robins), panned a little by pitch like a keyboard; then TONE. */
export class ZonesDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iVel = this.ii('vel')
  private readonly iIn = this.ii('in')
  private readonly oCv = this.oi('cvo')
  private readonly oGt = this.oi('gto')
  private readonly oVl = this.oi('vlo')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly P = {
    src: this.pi('src'),
    tune: this.pi('tune'),
    att: this.pi('att'),
    rel: this.pi('rel'),
    tone: this.pi('tone'),
    level: this.pi('level'),
    lo: this.pi('lo'),
    hi: this.pi('hi'),
    every: this.pi('every'),
    layers: this.pi('layers'),
    rr: this.pi('rr'),
    hold: this.pi('hold'),
    tail: this.pi('tail'),
    mlo: this.pi('mlo'),
  }
  private readonly factory: MultiSample
  /** The OWN multisample: its map comes from the m… params each time a note starts. */
  private readonly own: MultiSample = { data: new Float32Array(0), len: 0, rate: 48000, map: { lo: 0, every: 1, roots: 0, layers: 0, rr: 0, slot: 0 } }
  private readonly auto: AutoSampler
  private readonly voices: SampleVoice[]
  private readonly keys: KeyVoices
  private readonly was = new Uint8Array(MAX_VOICES)
  private readonly zone = new Int16Array(ZN_VOICES).fill(-1)
  private readonly pan = new Float32Array(ZN_VOICES)
  /** The next round-robin take, per zone. */
  private readonly rrNext = new Uint8Array(4 * 128)
  private readonly lpL: LowpassSvf
  private readonly lpR: LowpassSvf
  private tooLong = 0
  private uiNote = -1

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.factory = tinePiano()
    this.auto = new AutoSampler(fs)
    this.voices = Array.from({ length: ZN_VOICES }, () => new SampleVoice(fs))
    this.keys = new KeyVoices(fs)
    this.lpL = new LowpassSvf(fs)
    this.lpR = new LowpassSvf(fs)
  }

  onMidi(ev: MidiEvent): void {
    this.keys.midi(ev, ZN_VOICES)
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'button' && ev.name === 'auto' && ev.down) this.pressAuto()
    else if (ev.kind === 'surface' && ev.name === 'zones') {
      // the screen's keyboard: x is the note, y the velocity
      if (this.uiNote >= 0) this.keys.midi({ kind: 'off', note: this.uiNote })
      this.uiNote = ev.down ? Math.round(ev.x) : -1
      if (ev.down) this.keys.midi({ kind: 'on', note: this.uiNote, vel: Math.max(1, Math.round(ev.y * 127)) })
    }
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot !== 0) return
    this.own.data = data.slice()
    this.own.len = data.length
    this.own.rate = rate
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    return slot === 0 && this.own.len ? { rate: this.own.rate, data: this.own.data.slice(0, this.own.len) } : null
  }

  /** AUTO: start sampling the rack voice (again to stop, keeping what was there). */
  private pressAuto(): void {
    if (this.auto.active) return this.auto.stop()
    const p = this.p
    const ok = this.auto.start(
      Math.round(p[this.P.lo]),
      Math.round(p[this.P.hi]),
      ZN_EVERY[Math.round(p[this.P.every])] ?? 6,
      Math.round(p[this.P.layers]),
      Math.round(p[this.P.rr]),
      p[this.P.hold],
      p[this.P.tail],
    )
    this.tooLong = ok ? 0 : Math.round(this.fs * 1.5)
  }

  /** The takes are in: they become the OWN multisample. */
  private finishAuto(): void {
    const m = this.auto.map
    this.own.data = this.auto.buf
    this.own.len = this.auto.buf.length
    this.own.rate = this.fs
    const vals = [m.lo, m.every, m.roots, m.layers, m.rr, m.slot / this.fs]
    for (let i = 0; i < vals.length; i++) this.writeParam(this.P.mlo + i, vals[i])
    this.writeParam(this.P.src, 1)
    this.bufferOut.push({ slot: 0, rate: this.fs, data: this.own.data })
    this.rrNext.fill(0)
  }

  /** The multisample to play: OWN once it has takes, else the factory one. */
  private source(): MultiSample {
    const p = this.p
    const m = this.own.map
    if (p[this.P.src] < 0.5 || !this.own.len) return this.factory
    m.lo = Math.round(p[this.P.mlo])
    m.every = Math.max(1, Math.round(p[this.P.mlo + 1]))
    m.roots = Math.round(p[this.P.mlo + 2])
    m.layers = Math.round(p[this.P.mlo + 3])
    m.rr = Math.round(p[this.P.mlo + 4])
    m.slot = Math.round(p[this.P.mlo + 5] * this.own.rate)
    const fits = m.roots > 0 && m.layers > 0 && m.rr > 0 && m.slot > 0 && m.layers * m.rr * m.roots * m.slot <= this.own.len
    return fits ? this.own : this.factory
  }

  /** Start voice v on MIDI note `note` at velocity `vel` (0..1). */
  private start(v: number, note: number, vel: number): void {
    const s = this.source()
    const m = s.map
    const layer = layerFor(m, vel)
    const r = rootFor(m, note)
    const zi = layer * m.roots + r
    const k = this.rrNext[zi % this.rrNext.length] % m.rr
    this.rrNext[zi % this.rrNext.length] = (k + 1) % m.rr
    const at = takeAt(m, layer, k, r)
    const frac = vel * m.layers - layer
    const gain = m.layers === 1 ? 0.3 + 0.7 * vel : 0.7 + 0.3 * Math.min(1, frac)
    const vo = this.voices[v]
    vo.attack = this.p[this.P.att]
    vo.release = this.p[this.P.rel]
    vo.trigger(s, at, at + m.slot, Math.pow(2, (note + this.p[this.P.tune] - (m.lo + r * m.every)) / 12), gain)
    this.zone[v] = zi
    this.pan[v] = Math.max(-0.6, Math.min(0.6, (note - 60) / 40))
  }

  tick(): void {
    const p = this.p
    // AUTO drives the rack voice and records it
    if (this.auto.run(this.in[this.iIn])) this.finishAuto()
    this.out[this.oCv] = this.auto.cv
    this.out[this.oGt] = this.auto.gate
    this.out[this.oVl] = this.auto.vel
    // the keys or a poly cable
    const cvGate = this.patched[this.iGate] === 1
    const velIn = this.patched[this.iVel] === 1
    for (let v = 0; v < ZN_VOICES; v++) {
      const g = cvGate ? this.pin(this.iGate, v) > 1 : this.keys.held(v)
      if (g && !this.was[v]) {
        const note = 60 + (cvGate ? this.pin(this.iV, v) : this.keys.pitch[v] + this.in[this.iV]) * 12
        const vel = velIn ? Math.max(0, Math.min(1, this.pin(this.iVel, v) / 10)) : cvGate ? CABLE_VEL : this.keys.vel[v]
        this.start(v, note, vel)
      } else if (!g && this.was[v]) this.voices[v].noteOff()
      this.was[v] = g ? 1 : 0
    }
    let l = 0
    let r = 0
    for (let v = 0; v < ZN_VOICES; v++) {
      const vo = this.voices[v]
      if (!vo.active) {
        this.led[ZNL.voice0 + v] = -1
        continue
      }
      const y = vo.step()
      l += y * (1 - this.pan[v])
      r += y * (1 + this.pan[v])
      this.led[ZNL.voice0 + v] = this.zone[v]
    }
    this.lpL.set(p[this.P.tone], 0.1)
    this.lpR.set(p[this.P.tone], 0.1)
    const gain = p[this.P.level] * 5
    this.out[this.oL] = Math.tanh(this.lpL.run(l) * 0.9) * gain
    this.out[this.oR] = Math.tanh(this.lpR.run(r) * 0.9) * gain
    if (this.tooLong > 0) this.tooLong--
    this.led[ZNL.state] = this.auto.active ? 1 : this.tooLong > 0 ? 2 : 0
    this.led[ZNL.progress] = this.auto.progress
    this.led[ZNL.take] = this.auto.take
  }
}
