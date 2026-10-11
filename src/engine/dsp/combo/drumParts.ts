import { Biquad } from '../biquad'
import { Mode } from '../modal'

/** A circular drumhead's modes (ideal membrane: (0,1) (1,1) (2,1) (0,2)
 *  (3,1) (1,2) (4,1) (2,2)), and how much of each a centre and an edge strike
 *  excite (a centre hit drives the round modes, an edge hit the rest). */
const RATIOS = [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.16, 3.5]
const CENTRE = [1, 0.3, 0.18, 0.5, 0.1, 0.2, 0.06, 0.12]
const EDGE = [0.55, 0.9, 0.75, 0.25, 0.55, 0.35, 0.4, 0.2]
/** Retune the bending modes every this many samples (cheaper than per sample). */
const RETUNE = 32

export interface HeadSpec {
  /** Fundamental (Hz), its decay (s), and how many modes ring (1 = a pure sine, for drum machines). */
  f: number
  decay: number
  modes: number
  /** Where it's struck, 0 edge … 1 centre. */
  centre: number
  /** Pitch bend at the strike (fraction above f, the head's tension spike) and how fast it settles (s). */
  bend: number
  bendTime: number
  /** The beater's or stick's contact: its level and brightness (Hz). */
  click: number
  clickHz: number
}

/** A struck drum: a membrane's modes (bending down in pitch after a hard
 *  blow, as a real head does) plus the beater's or stick's contact noise.
 *  Every strike is a little different (mode levels and click vary). */
export class Drum {
  private readonly m = RATIOS.map(() => new Mode())
  private spec: HeadSpec | null = null
  private level = 0
  private bendNow = 0
  private bendK = 1
  private count = 0
  private click = 0
  private clickK = 1
  private readonly clickF: Biquad
  live = false

  constructor(private readonly fs: number) {
    this.clickF = new Biquad(fs)
  }

  strike(s: HeadSpec, vel: number, rnd: () => number): void {
    if (this.spec !== s) this.clickF.bandpass(s.clickHz, 0.9)
    this.spec = s
    this.level = vel
    this.bendNow = s.bend * (0.4 + 0.6 * vel)
    this.bendK = Math.exp(-RETUNE / (s.bendTime * this.fs))
    this.count = 0
    this.retune()
    for (let k = 0; k < s.modes; k++) {
      const shape = CENTRE[k] * s.centre + EDGE[k] * (1 - s.centre)
      // harder blows bring the upper modes up; each strike lands a little differently
      const amp = vel * shape * (k === 0 ? 1 : 0.55 + 0.45 * vel) * (0.85 + 0.3 * rnd())
      this.m[k].strike(amp)
    }
    this.click = s.click * vel * (0.8 + 0.4 * rnd())
    this.clickK = Math.exp(-1 / (0.0025 * this.fs))
    this.live = true
  }

  /** Damp it (a hand on the head, a choked cymbal). */
  mute(): void {
    for (const m of this.m) {
      m.re *= 0.1
      m.im *= 0.1
    }
  }

  private retune(): void {
    const s = this.spec!
    const f = s.f * (1 + this.bendNow)
    for (let k = 0; k < s.modes; k++) this.m[k].tune(f * RATIOS[k], (s.decay / (1 + 0.55 * k)) * (k === 0 ? 1 : 0.8), this.fs)
  }

  step(noise: number): number {
    if (!this.live) return 0
    const s = this.spec!
    if (++this.count >= RETUNE && this.bendNow > 1e-4) {
      this.count = 0
      this.bendNow *= this.bendK
      this.retune()
    }
    let y = 0
    let e = 0
    for (let k = 0; k < s.modes; k++) {
      y += this.m[k].step()
      e += this.m[k].energy
    }
    if (this.click > 1e-5) {
      y += this.clickF.run(noise) * this.click
      this.click *= this.clickK
    }
    if (e < 1e-9 && this.click < 1e-5) this.live = false
    return y * (s.modes === 1 ? 1 : 0.6)
  }
}

export interface MetalSpec {
  /** Resonances of the plate (Hz) and how sharp they are: the cymbal's colour. */
  bands: number[]
  q: number
  /** Below this it's quiet (Hz). */
  hp: number
  /** Its bell and stick ping: a fundamental (Hz, 0 = none), the partials' level. */
  bell: number
  bellLevel: number
  /** The wash's rise (s; a crash blooms, a hat doesn't). */
  attack: number
}
const BELL = [1, 2.04, 2.83, 3.75, 4.61, 5.58]
const BELL_AMP = [0.5, 0.45, 0.25, 0.2, 0.14, 0.1]

/** A cymbal: noise through the plate's resonances (the wash), a few
 *  inharmonic bell partials, and the stick's tick. Hats share one: a closed
 *  hit shortens the decay of whatever is ringing (the pedal's choke). */
export class Metal {
  private readonly bands: Biquad[] = []
  private readonly hp: Biquad
  private readonly tick: Biquad
  private readonly bell = BELL.map(() => new Mode())
  private spec: MetalSpec | null = null
  private env = 0
  private target = 0
  private decayK = 1
  private attackK = 0
  private tickLevel = 0
  private bellLive = false

  constructor(private readonly fs: number) {
    for (let i = 0; i < 8; i++) this.bands.push(new Biquad(fs))
    this.hp = new Biquad(fs)
    this.tick = new Biquad(fs).bandpass(6500, 1.2)
  }

  strike(s: MetalSpec, vel: number, decay: number, rnd: () => number): void {
    if (this.spec !== s) {
      for (let i = 0; i < s.bands.length; i++) this.bands[i].bandpass(s.bands[i], s.q)
      this.hp.highpass(s.hp, 0.7)
      this.spec = s
    }
    const v = vel * (0.88 + 0.24 * rnd())
    this.target = v
    if (s.attack <= 0) this.env = Math.max(this.env, v)
    this.attackK = s.attack > 0 ? 1 - Math.exp(-1 / (s.attack * this.fs)) : 1
    this.decayK = Math.exp(-1 / (decay * this.fs))
    this.tickLevel = v * 0.5
    if (s.bell > 0) {
      for (let k = 0; k < BELL.length; k++) {
        this.bell[k].tune(s.bell * BELL[k] * (0.995 + 0.01 * rnd()), decay * (1.4 - 0.15 * k), this.fs)
        this.bell[k].strike(v * BELL_AMP[k] * s.bellLevel)
      }
      this.bellLive = true
    }
  }

  /** The pedal closes on it (or a hand grabs it): whatever rings dies fast. */
  choke(decay: number): void {
    this.decayK = Math.min(this.decayK, Math.exp(-1 / (decay * this.fs)))
    this.target = 0
  }

  step(noise: number): number {
    const s = this.spec
    if (!s) return 0
    if (this.target > 0) {
      this.env += (this.target - this.env) * this.attackK
      if (this.env >= this.target * 0.98) this.target = 0
    } else this.env *= this.decayK
    let y = 0
    if (this.env > 1e-5) {
      const x = noise * this.env
      for (let i = 0; i < s.bands.length; i++) y += this.bands[i].run(x)
      y = this.hp.run(y) * 1.6
    }
    if (this.tickLevel > 1e-5) {
      y += this.tick.run(noise) * this.tickLevel
      this.tickLevel *= 0.985
    }
    if (this.bellLive) {
      let e = 0
      for (const m of this.bell) {
        y += m.step()
        e += m.energy
      }
      if (e < 1e-10) this.bellLive = false
    }
    return y
  }
}
