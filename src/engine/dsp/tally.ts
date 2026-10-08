import { melodyId } from '../../modules/specs/tally'
import {
  ADSR_SOUND,
  digitsOf,
  MELODY_MAX,
  MELODY_OFFSET,
  REC,
  TALLY_LOW,
  TALLY_RHYTHMS,
  TLL,
} from '../../modules/specs/tallyDefs'
import type { ModuleSpec } from '../../modules/types'
import { DRUM_CHANNEL, type MidiEvent, type UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { C4, TAU } from './util'

/** A sound: wave (0–9), attack, decay (to sustain), sustain level, sustain
 *  time (Infinity = hold), release (s), vibrato (semitones), tremolo (0–1). */
interface Voice {
  wave: number
  a: number
  d: number
  s: number
  hold: number
  r: number
  vib: number
  trem: number
}
const PRESETS: Voice[] = [
  { wave: 0, a: 0.002, d: 0.9, s: 0, hold: Infinity, r: 0.15, vib: 0, trem: 0 }, // PIANO
  { wave: 1, a: 0.01, d: 1.5, s: 0.3, hold: Infinity, r: 0.4, vib: 0.35, trem: 0.3 }, // FANTASY
  { wave: 2, a: 0.18, d: 0.3, s: 0.8, hold: Infinity, r: 0.2, vib: 0.25, trem: 0 }, // VIOLIN
  { wave: 3, a: 0.07, d: 0.2, s: 0.85, hold: Infinity, r: 0.12, vib: 0.12, trem: 0 }, // FLUTE
  { wave: 4, a: 0.002, d: 1.4, s: 0, hold: Infinity, r: 0.1, vib: 0, trem: 0 }, // GUITAR
]
/** The ADSR code's digits 0–9 as times (s). */
const TIMES = [0.002, 0.01, 0.03, 0.06, 0.1, 0.2, 0.4, 0.7, 1.2, 2]
/** ♪: digits 0–9 as a major scale up from C. */
const DIGIT_NOTES = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16]

/** TALLY's engine: one digital voice, the rhythm box, the melody memory and
 *  ♪. See the spec. */
export class TallyDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iTrig = this.ii('trig')
  private readonly iClk = this.ii('clk')
  private readonly iRst = this.ii('rst')
  private readonly rst = new Schmitt()
  private readonly P = {
    mode: this.pi('mode'),
    sound: this.pi('sound'),
    oct: this.pi('oct'),
    rhythm: this.pi('rhythm'),
    tempo: this.pi('tempo'),
    balance: this.pi('balance'),
    vol: this.pi('vol'),
    run: this.pi('run'),
    code: this.pi('code'),
    mlen: this.pi('mlen'),
  }
  private readonly pMel = Int32Array.from({ length: MELODY_MAX }, (_, i) => this.pi(melodyId(i)))
  private readonly voice: Voice = { ...PRESETS[0] }
  private lastCode = -1
  // keys held (strip + MIDI), newest last: semitones from C4
  private readonly held = new Int32Array(16)
  private nHeld = 0
  private oneKey = false
  private oneNote = 0
  private mpos = 0
  private readonly trig = new Schmitt()
  private readonly clk = new Schmitt()
  // the voice
  private note = -99
  private gateWas = false
  private env = 0
  private stage = 0 // 0 idle, 1 attack, 2 decay, 3 sustain, 4 release
  private sustainLeft = 0
  private ph = 0
  private ph2 = 0
  private lfo = 0
  private lp = 0
  /** Seconds since the note started (vibrato fades in). */
  private noteAge = 0
  private seed = 22222
  // rhythm
  private step = -1
  private stepAcc = 0
  private stepPeriod = 0
  private sinceClk = 0
  private poEnv = 0
  private poPh = 0
  private piEnv = 0
  private piPh = 0
  private shaEnv = 0
  // ♪
  private readonly digits = new Int8Array(8)
  private nDigits = 0
  private digitAt = -1
  private digitLeft = 0
  private lastMode = -1

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.stepPeriod = fs / 8
  }

  private noise(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
    return this.seed / 2147483648
  }

  private press(semis: number): void {
    if (this.nHeld < this.held.length) this.held[this.nHeld++] = semis
    // REC: everything played is remembered
    if (Math.round(this.p[this.P.mode]) === REC) {
      const n = Math.round(this.p[this.P.mlen])
      if (n < MELODY_MAX) {
        this.writeParam(this.pMel[n], semis + MELODY_OFFSET)
        this.writeParam(this.P.mlen, n + 1)
      }
    }
  }

  private release(semis: number): void {
    for (let i = 0; i < this.nHeld; i++)
      if (this.held[i] === semis) {
        for (let j = i; j < this.nHeld - 1; j++) this.held[j] = this.held[j + 1]
        this.nHeld--
        return
      }
  }

  /** ONE KEY PLAY: the next remembered note. */
  private oneKeyDown(): void {
    const n = Math.round(this.p[this.P.mlen])
    if (!n) return
    if (this.mpos >= n) this.mpos = 0
    this.oneNote = Math.round(this.p[this.pMel[this.mpos]]) - MELODY_OFFSET
    this.mpos = (this.mpos + 1) % n
    this.oneKey = true
  }

  onMidi(ev: MidiEvent): void {
    if ((ev.kind === 'on' || ev.kind === 'off') && ev.ch === DRUM_CHANNEL) return
    if (ev.kind === 'on') this.press(ev.note - 60)
    else if (ev.kind === 'off') this.release(ev.note - 60)
    else if (ev.kind === 'panic') this.nHeld = 0
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'key') {
      const base = TALLY_LOW + Math.round(ev.x)
      if (ev.down) this.press(base + (Math.round(this.p[this.P.oct]) - 1) * 12)
      else for (let o = -12; o <= 12; o += 12) this.release(base + o) // even if OCTAVE moved while held
    } else if (ev.name === 'ok') {
      if (ev.down) this.oneKeyDown()
      else this.oneKey = false
    } else if (ev.name === 'num') {
      // ♪: play the display's digits (leading zeros dropped)
      const s = String(Math.max(0, Math.round(Math.abs(ev.x)))).slice(0, 8)
      this.nDigits = s.length
      for (let i = 0; i < s.length; i++) this.digits[i] = s.charCodeAt(i) - 48
      this.digitAt = 0
      this.digitLeft = 0
    }
  }

  /** The current sound (presets, or the ADSR code). */
  private sound(): Voice {
    const s = Math.round(this.p[this.P.sound])
    if (s !== ADSR_SOUND) return PRESETS[s]
    const code = this.p[this.P.code]
    if (code !== this.lastCode) {
      this.lastCode = code
      const d = digitsOf(code)
      const v = this.voice
      v.wave = d[0]
      v.a = TIMES[d[1]]
      v.d = TIMES[d[2]] * 2
      v.s = d[3] / 9
      v.hold = d[4] === 9 ? Infinity : TIMES[d[4]] * 3
      v.r = TIMES[d[5]] * 2
      v.vib = (d[6] / 9) * 0.5
      v.trem = (d[7] / 9) * 0.6
    }
    return this.voice
  }

  /** One sample of wave w at phase p (naive, as the cheap original was). */
  private wave(w: number, p: number, dt: number): number {
    switch (w) {
      case 1:
        return p < 0.5 ? 1 : -1
      case 2:
        return p < 0.125 ? 1 : -0.6
      case 3: {
        const sq = p < 0.5 ? 1 : -1
        this.lp += (sq - this.lp) * Math.min(1, dt * 40) // a softened square
        return this.lp
      }
      case 4:
        return p < 0.1 ? 1 : -0.5
      case 5:
        return p < 0.33 ? 1 : -1
      case 6: {
        const p2 = (p * 2) % 1
        return 0.6 * (p < 0.5 ? 1 : -1) + 0.4 * (p2 < 0.5 ? 1 : -1)
      }
      case 7:
        return (p < 0.5 ? 1 : -1) * (this.ph2 < 0.5 ? 1 : -1)
      case 8:
        return p < 0.5 + 0.4 * Math.sin(TAU * this.lfo * 0.3) ? 1 : -1
      case 9:
        return (p < 0.05 ? 1 : -0.3) + this.noise() * 0.25
      default:
        return p < 0.25 ? 1 : -0.6
    }
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const mode = Math.round(p[this.P.mode])
    if (mode !== this.lastMode) {
      if (mode === REC && this.lastMode >= 0) this.writeParam(this.P.mlen, 0) // REC starts a fresh melody
      if (mode !== REC) this.mpos = 0
      this.lastMode = mode
    }
    // RST: the rhythm back to its first beat, the tune back to its first note
    if (this.rst.rise(this.in[this.iRst])) {
      this.step = -1
      this.stepAcc = 0
      this.mpos = 0
    }
    if (this.trig.rise(this.in[this.iTrig])) this.oneKeyDown()
    else if (this.oneKey && this.patched[this.iTrig] && this.in[this.iTrig] < 1) this.oneKey = false

    // ♪: one digit per eighth note, each released just before the next
    let digitNote = -99
    if (this.digitAt >= 0) {
      const len = (60 / p[this.P.tempo] / 2) * fs
      if (this.digitLeft <= 0) this.digitLeft = len
      if (this.digitLeft > len * 0.2) digitNote = DIGIT_NOTES[this.digits[this.digitAt]]
      if (--this.digitLeft <= 0 && ++this.digitAt >= this.nDigits) this.digitAt = -1
    }

    // which note, if any: GATE cable, ONE KEY, ♪, the keys
    let note = -99
    let gate = false
    if (this.patched[this.iGate]) {
      gate = this.in[this.iGate] > 1
      note = Math.round(this.in[this.iV] * 12)
    } else if (this.oneKey) {
      gate = true
      note = this.oneNote
    } else if (digitNote > -99) {
      gate = true
      note = digitNote
    } else if (this.nHeld > 0) {
      gate = true
      note = this.held[this.nHeld - 1]
    }
    const v = this.sound()
    if (gate && (!this.gateWas || note !== this.note)) {
      this.stage = 1
      this.noteAge = 0
      this.sustainLeft = v.hold
    } else if (!gate && this.gateWas) this.stage = 4
    if (gate) this.note = note
    this.gateWas = gate

    // envelope
    const dt = 1 / fs
    this.noteAge += dt
    switch (this.stage) {
      case 1:
        this.env += dt / Math.max(0.001, v.a)
        if (this.env >= 1) (this.env = 1), (this.stage = 2)
        break
      case 2:
        this.env = v.s + (this.env - v.s) * Math.exp(-4.6 * dt / v.d)
        if (Math.abs(this.env - v.s) < 0.002) this.stage = 3
        break
      case 3:
        this.sustainLeft -= dt
        if (this.sustainLeft <= 0) this.stage = 4
        break
      case 4:
        this.env *= Math.exp(-4.6 * dt / v.r)
        if (this.env < 1e-4) (this.env = 0), (this.stage = 0)
        break
    }

    // the voice: naive digital waves, vibrato arriving late, tremolo
    this.lfo += 5.5 * dt
    if (this.lfo >= 1) this.lfo -= 1
    const vibIn = Math.min(1, this.noteAge / 0.35)
    const semis = this.note + v.vib * vibIn * Math.sin(TAU * this.lfo)
    const f = C4 * Math.pow(2, semis / 12)
    const fdt = f / fs
    this.ph = (this.ph + fdt) % 1
    this.ph2 = (this.ph2 + fdt * 1.5) % 1
    let mel = this.stage ? this.wave(v.wave, this.ph, fdt) * this.env : 0
    mel *= 1 - v.trem * 0.5 * (1 + Math.sin(TAU * this.lfo * 1.1))
    mel = Math.round(mel * 32) / 32 // a cheap 6-bit converter

    // the rhythm box: 16ths from CLK, or TEMPO
    let rhy = 0
    const r = TALLY_RHYTHMS[Math.round(p[this.P.rhythm])]
    if (p[this.P.run] >= 0.5) {
      let fire = false
      if (this.patched[this.iClk]) {
        this.sinceClk++
        if (this.clk.rise(this.in[this.iClk])) {
          this.stepPeriod = this.sinceClk
          this.sinceClk = 0
          fire = true
        }
      } else {
        const sixteenth = (60 / p[this.P.tempo] / 4) * fs
        const swing = r.swing ?? 0
        const len = (this.step + 1) % 2 === 1 ? sixteenth * (1 + swing) : sixteenth * (1 - swing)
        if (++this.stepAcc >= len || this.step < 0) {
          this.stepAcc = 0
          fire = true
        }
      }
      if (fire) {
        this.step = (this.step + 1) % r.po.length
        if (r.po[this.step] === 'x') (this.poEnv = 1), (this.poPh = 0)
        if (r.pi[this.step] === 'x') (this.piEnv = 1), (this.piPh = 0)
        if (r.sha[this.step] === 'x') this.shaEnv = 1
      }
    } else this.step = -1
    if (this.poEnv > 1e-4) {
      this.poPh = (this.poPh + (110 + 150 * this.poEnv) * dt) % 1
      rhy += Math.sin(TAU * this.poPh) * this.poEnv
      this.poEnv *= Math.exp(-dt / 0.05)
    }
    if (this.piEnv > 1e-4) {
      this.piPh = (this.piPh + 1250 * dt) % 1
      rhy += (this.piPh < 0.5 ? 0.5 : -0.5) * this.piEnv
      this.piEnv *= Math.exp(-dt / 0.025)
    }
    if (this.shaEnv > 1e-4) {
      rhy += this.noise() * 0.45 * this.shaEnv
      this.shaEnv *= Math.exp(-dt / 0.035)
    }
    rhy = Math.round(rhy * 16) / 16

    const b = p[this.P.balance]
    const vol = p[this.P.vol]
    this.out[0] = 4 * vol * (mel * Math.min(1, 2 * (1 - b)) + rhy * Math.min(1, 2 * b))
    this.out[1] = this.note > -99 ? this.note / 12 : 0
    this.out[2] = gate ? 10 : 0
    this.out[3] = 4 * vol * rhy
    this.led[TLL.note] = this.stage ? this.note : -99
    this.led[TLL.gate] = gate ? 1 : 0
    this.led[TLL.step] = this.step
    this.led[TLL.mpos] = this.mpos
    this.led[TLL.mlen] = p[this.P.mlen]
    this.led[TLL.digit] = this.digitAt >= 0 && this.digitAt < this.nDigits ? this.digits[this.digitAt] : -1
  }
}
