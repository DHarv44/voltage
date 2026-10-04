import type { ModuleSpec } from '../../modules/types'
import { OMNI_ROOT_SEMIS, OMNI_ZONES, OML } from '../../modules/specs/omnichord'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { C4, polyBlep, TAU } from './util'

const CHORDS = [
  [0, 4, 7],
  [0, 3, 7],
  [0, 4, 7, 10],
]
const HARP_VOICES = 16
const TRIG = 0.005

/** One harp pluck: three slightly stretched partials, the upper ones dying
 *  faster, like the Omnichord's bell-ish "Sonic Strings". */
class Pluck {
  f = 0
  ph1 = 0
  ph2 = 0
  ph3 = 0
  env = 0
  age = 1e9
}

export class OmnichordDsp extends Dsp {
  private readonly pChord = this.pi('chord')
  private readonly pBass = this.pi('bass')
  private readonly pHarp = this.pi('harp')
  private readonly pSustain = this.pi('sustain')
  private readonly pTone = this.pi('tone')
  private readonly oNotes = this.oi('notes')
  private root = 3 // C (index into the circle of fifths)
  private type = 0
  private held = 0
  private zone = -1
  private strumming = false
  private flash = 0
  private trig = 0
  private lastPitch = 0
  private padEnv = 0
  private readonly padPh = new Float64Array(5)
  private padLp = 0
  private harpLp = 0
  private next = 0
  private readonly plucks = Array.from({ length: HARP_VOICES }, () => new Pluck())
  private readonly attack: number
  private readonly release: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.attack = 1 - Math.exp(-1 / (0.015 * fs))
    this.release = 1 - Math.exp(-1 / (0.18 * fs))
  }

  private semis(): number {
    return OMNI_ROOT_SEMIS[this.root]
  }

  /** Strum zone → semitones from C4: chord tones climbing from an octave below. */
  private zoneNote(z: number): number {
    const tones = CHORDS[this.type]
    return this.semis() - 12 + tones[z % tones.length] + 12 * Math.floor(z / tones.length)
  }

  private pluck(z: number): void {
    const v = this.plucks[this.next++ % HARP_VOICES]
    const semis = this.zoneNote(z)
    v.f = C4 * Math.pow(2, semis / 12)
    v.ph1 = v.ph2 = v.ph3 = 0
    v.env = 1
    v.age = 0
    this.lastPitch = semis / 12
    this.trig = TRIG
    this.flash = 1
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'chord') {
      if (ev.down) {
        this.root = Math.min(OMNI_ROOT_SEMIS.length - 1, Math.max(0, Math.round(ev.x)))
        this.type = Math.min(CHORDS.length - 1, Math.max(0, Math.round(ev.y)))
        this.held++
      } else this.held = Math.max(0, this.held - 1)
    } else if (ev.name === 'strum') {
      const z = Math.min(OMNI_ZONES - 1, Math.max(0, Math.floor(ev.x * OMNI_ZONES)))
      if (!ev.down) {
        this.strumming = false
        return
      }
      if (!this.strumming) this.pluck(z)
      else if (z !== this.zone) {
        // a fast swipe crosses several strings between pointer events: play each
        const step = z > this.zone ? 1 : -1
        for (let k = this.zone + step; k !== z + step; k += step) this.pluck(k)
      }
      this.strumming = true
      this.zone = z
    }
  }

  tick(): void {
    const p = this.p
    const fs = this.fs
    const tones = CHORDS[this.type]
    const base = this.semis() - 12

    // Chord pad: organ-ish saws on the chord with the root an octave below.
    this.padEnv += ((this.held ? 1 : 0) - this.padEnv) * (this.held ? this.attack : this.release)
    let pad = 0
    let bass = 0
    if (this.padEnv > 1e-4) {
      for (let k = 0; k <= tones.length; k++) {
        const semis = k === tones.length ? base - 12 : base + tones[k]
        const dt = (C4 * Math.pow(2, semis / 12)) / fs
        const ph = (this.padPh[k] + dt) % 1
        this.padPh[k] = ph
        const s = 2 * ph - 1 - polyBlep(ph, dt)
        if (k === tones.length) bass = s
        else pad += s
      }
      const cut = 0.02 + p[this.pTone] * 0.25
      this.padLp += ((pad * 0.3 * p[this.pChord] + bass * 0.5 * p[this.pBass]) * this.padEnv - this.padLp) * cut
    } else this.padLp *= 0.99

    // Harp plucks.
    let harp = 0
    const sus = p[this.pSustain]
    const decay = Math.exp(-1 / (sus * fs))
    for (const v of this.plucks) {
      if (v.env < 1e-4) continue
      v.age += 1 / fs
      v.env *= decay
      const vib = 1 + 0.003 * Math.sin(TAU * 5.2 * v.age)
      v.ph1 = (v.ph1 + (v.f * vib) / fs) % 1
      v.ph2 = (v.ph2 + (v.f * 2.005 * vib) / fs) % 1
      v.ph3 = (v.ph3 + (v.f * 3.99 * vib) / fs) % 1
      const e2 = Math.pow(v.env, 2.2)
      const e3 = Math.pow(v.env, 4)
      const attack = Math.min(1, v.age / 0.002)
      harp += (Math.sin(TAU * v.ph1) * v.env + Math.sin(TAU * v.ph2) * 0.35 * e2 + Math.sin(TAU * v.ph3) * 0.18 * e3) * attack
    }
    this.harpLp += (harp - this.harpLp) * (0.15 + p[this.pTone] * 0.8)
    const harpOut = this.harpLp * 0.35 * p[this.pHarp]

    const o = this.out
    o[0] = (this.padLp + harpOut) * 5
    o[1] = this.padLp * 5
    o[2] = harpOut * 5
    o[3] = base / 12
    o[4] = this.held ? 10 : 0
    o[5] = this.trig > 0 ? 10 : 0
    o[6] = this.lastPitch
    for (let k = 0; k < tones.length; k++) this.pout(this.oNotes, k, (base + tones[k]) / 12)
    this.chans[this.oNotes] = tones.length

    if (this.trig > 0) this.trig -= 1 / fs
    this.flash *= Math.exp(-1 / (0.25 * fs))
    const led = this.led
    led[OML.root] = this.root
    led[OML.type] = this.type
    led[OML.held] = this.held ? 1 : 0
    led[OML.zone] = this.zone
    led[OML.flash] = this.flash
  }
}
