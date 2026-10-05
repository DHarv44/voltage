import type { ModuleSpec } from '../../modules/types'
import { CWL, wheelPc } from '../../modules/specs/chordwheel'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { C4, TAU } from './util'

/** Triads per ring (major, minor, diminished), and each ring's root offset
 *  from the position's major key (relative minor = +9, leading-tone dim = +11). */
const TRIADS = [
  [0, 4, 7],
  [0, 3, 7],
  [0, 3, 6],
]
const RING_ROOT = [0, 9, 11]
const TRIG = 0.005
const VOICES = 5 // up to four chord tones + the bass

export class ChordWheelDsp extends Dsp {
  private readonly pKey = this.pi('key')
  private readonly pOct = this.pi('oct')
  private readonly pVoicing = this.pi('voicing')
  private readonly pLevel = this.pi('level')
  private readonly pTone = this.pi('tone')
  private readonly oNotes = this.oi('notes')
  private ring = 0
  private pos = 0
  private held = false
  private seventh = false
  private shown = false
  private trig = 0
  /** Current chord, in volts (0 V = C4): up to four tones, and the bass. */
  private readonly tones = new Float64Array(4)
  private count = 3
  private bass = -1
  private readonly ph = new Float64Array(VOICES)
  private env = 0
  private lp = 0
  private readonly attack: number
  private readonly release: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.attack = 1 - Math.exp(-1 / (0.03 * fs))
    this.release = 1 - Math.exp(-1 / (0.45 * fs))
    this.voice()
  }

  /** Work out the chord's notes for the current ring/position/knobs. */
  private voice(): void {
    const pc = (wheelPc(this.pos) + RING_ROOT[this.ring]) % 12
    // keep roots near middle C so moving round the circle never leaps an octave
    const root = (pc > 6 ? pc - 12 : pc) + 12 * this.p[this.pOct]
    const triad = TRIADS[this.ring]
    const open = this.p[this.pVoicing] >= 0.5
    this.count = this.seventh ? 4 : 3
    for (let k = 0; k < 3; k++) this.tones[k] = (root + triad[k] + (open && k === 1 ? 12 : 0)) / 12
    // 7th: minor seventh on every ring (dominant 7, minor 7, half-diminished)
    if (this.seventh) this.tones[3] = (root + 10) / 12
    this.bass = (root - 12) / 12
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'seventh') {
      if (ev.down) {
        this.seventh = !this.seventh
        this.voice()
      }
      return
    }
    if (ev.name !== 'chord') return
    if (!ev.down) {
      this.held = false
      return
    }
    const ring = Math.min(2, Math.max(0, Math.round(ev.y)))
    const pos = ((Math.round(ev.x) % 12) + 12) % 12
    if (!this.held || ring !== this.ring || pos !== this.pos) this.trig = TRIG
    this.ring = ring
    this.pos = pos
    this.held = true
    this.shown = true
    this.voice()
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    this.voice() // knobs (octave, voicing) apply straight away

    // Built-in pad: soft organ-ish tones (fundamental + two quiet harmonics).
    this.env += ((this.held ? 1 : 0) - this.env) * (this.held ? this.attack : this.release)
    let pad = 0
    if (this.env > 1e-4) {
      for (let k = 0; k <= this.count; k++) {
        const v = k === this.count ? this.bass : this.tones[k]
        const ph = (this.ph[k] + (C4 * Math.pow(2, v)) / fs) % 1
        this.ph[k] = ph
        const s = Math.sin(TAU * ph) + 0.25 * Math.sin(2 * TAU * ph) + 0.1 * Math.sin(3 * TAU * ph)
        pad += k === this.count ? s * 0.6 : s * 0.3
      }
      this.lp += (pad * this.env - this.lp) * (0.03 + p[this.pTone] * 0.4)
    } else this.lp *= 0.99

    const o = this.out
    o[0] = this.lp * p[this.pLevel] * 4
    for (let k = 0; k < this.count; k++) this.pout(this.oNotes, k, this.tones[k])
    this.chans[this.oNotes] = this.count
    o[2] = this.tones[0]
    o[3] = this.bass
    o[4] = this.held ? 10 : 0
    o[5] = this.trig > 0 ? 10 : 0
    if (this.trig > 0) this.trig -= 1 / fs

    const led = this.led
    led[CWL.key] = p[this.pKey]
    led[CWL.ring] = this.shown ? this.ring : -1
    led[CWL.pos] = this.shown ? this.pos : -1
    led[CWL.held] = this.held ? 1 : 0
    led[CWL.seventh] = this.seventh ? 1 : 0
  }
}
