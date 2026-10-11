import type { Genre } from '../../../modules/specs/combo/genres'
import { polyBlep } from '../util'

type BassName = Genre['bass']

/** How each bass player sounds: the filter's opening and where it settles
 *  (Hz), resonance, the attack and how the note dies (s), sustain level,
 *  drive, and how much of the string's thump. */
const MODELS: Record<BassName, { open: number; settle: number; res: number; att: number; decay: number; sus: number; drive: number; thump: number; glide: number }> = {
  FINGER: { open: 1600, settle: 520, res: 0.1, att: 0.004, decay: 0.45, sus: 0.65, drive: 1.1, thump: 0.15, glide: 0 },
  PICK: { open: 3400, settle: 900, res: 0.15, att: 0.002, decay: 0.35, sus: 0.7, drive: 1.8, thump: 0.3, glide: 0 },
  UPRIGHT: { open: 900, settle: 600, res: 0, att: 0.008, decay: 1.1, sus: 0, drive: 1, thump: 0.45, glide: 0 },
  SYNTH: { open: 3000, settle: 380, res: 0.55, att: 0.003, decay: 0.3, sus: 0.6, drive: 1.3, thump: 0, glide: 0 },
  SUB: { open: 400, settle: 400, res: 0, att: 0.005, decay: 1.6, sus: 0.85, drive: 1.6, thump: 0, glide: 0.04 },
}

/** COMBO's bass player: one voice, five instruments (fingers, a pick, a
 *  double bass, a filtered synth saw, an 808-style sub with its glide). */
export class BassVoice {
  private m = MODELS.FINGER
  private name: BassName = 'FINGER'
  private ph = 0
  private f = 55
  private target = 55
  private env = 0
  private gate = false
  private stage = 0
  private vel = 0.8
  private cut = 0
  private s1 = 0
  private s2 = 0
  private thump = 0
  private thumpLp = 0
  private rng = 0x9e3779b9

  constructor(private readonly fs: number) {}

  setModel(name: BassName): void {
    this.name = name
    this.m = MODELS[name]
  }

  noteOn(midi: number, vel: number): void {
    this.target = 440 * Math.pow(2, (midi - 69) / 12)
    if (!this.m.glide || this.env < 0.01) this.f = this.target
    this.vel = vel
    this.gate = true
    this.stage = 0
    this.cut = this.m.open * (0.5 + 0.5 * vel)
    this.thump = this.m.thump * vel
  }

  noteOff(): void {
    this.gate = false
  }

  step(): number {
    const fs = this.fs
    const m = this.m
    // pitch (the sub glides into each note)
    this.f = m.glide ? this.target + (this.f - this.target) * Math.exp(-1 / (m.glide * fs)) : this.target
    const dt = this.f / fs
    this.ph += dt
    if (this.ph >= 1) this.ph -= 1
    // amplitude: attack, then decay toward sustain while held; a quick release after
    if (this.gate) {
      if (this.stage === 0) {
        this.env += 1 / (m.att * fs)
        if (this.env >= 1) {
          this.env = 1
          this.stage = 1
        }
      } else this.env = m.sus + (this.env - m.sus) * Math.exp(-1 / (m.decay * fs))
    } else this.env *= Math.exp(-1 / (0.06 * fs))
    if (this.env < 1e-5 && !this.gate) return 0
    // the source
    let x: number
    if (this.name === 'UPRIGHT' || this.name === 'SUB') {
      const a = 2 * Math.PI * this.ph
      x = Math.sin(a) + (this.name === 'UPRIGHT' ? 0.35 * Math.sin(2 * a) + 0.1 * Math.sin(3 * a) : 0)
    } else x = 2 * this.ph - 1 - polyBlep(this.ph, dt)
    // the filter closes after the attack (a plucked string's brightness dies first)
    this.cut = m.settle + (this.cut - m.settle) * Math.exp(-1 / (0.12 * fs))
    const g = 1 - Math.exp((-2 * Math.PI * this.cut) / fs)
    const fb = m.res * 3.2 * (this.s2 - x * 0.1)
    this.s1 += (x - fb - this.s1) * g
    this.s2 += (this.s1 - this.s2) * g
    let y = this.s2 * this.env * this.vel
    // the string's thump at the start of the note
    if (this.thump > 1e-4) {
      this.rng ^= this.rng << 13
      this.rng ^= this.rng >>> 17
      this.rng ^= this.rng << 5
      this.thumpLp += ((this.rng >>> 0) / 2147483648 - 1 - this.thumpLp) * 0.06
      y += this.thumpLp * this.thump
      this.thump *= Math.exp(-1 / (0.018 * fs))
    }
    return Math.tanh(y * m.drive) / Math.tanh(m.drive)
  }
}
