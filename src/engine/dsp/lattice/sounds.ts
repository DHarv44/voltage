import { DRUMS } from '../../../modules/specs/lattice'
import { SketchDrums } from '../sketchbook/drums'
import { render } from '../sketchbook/engines'
import { Voice } from '../sketchbook/voice'
import type { Rng } from '../util'

/** A LATTICE sound: one of SKETCHBOOK's engines with its four knobs and an
 *  envelope, voiced for a grid of lights (in LT_SOUNDS order; DRUMS is the kit). */
interface Sound {
  engine: number
  k: number[]
  a: number
  d: number
  s: number
  r: number
}
const SOUNDS: Sound[] = [
  { engine: 1, k: [0.45, 0.45, 0.1, 0.35], a: 0.002, d: 0.9, s: 0, r: 0.6 }, // BELL: two-op FM
  { engine: 2, k: [0.65, 0.65, 0.45, 0.25], a: 0.001, d: 2, s: 0.3, r: 0.8 }, // PLUCK: a plucked string
  { engine: 1, k: [0.95, 0.3, 0, 0.6], a: 0.003, d: 1.1, s: 0, r: 0.8 }, // GLASS: FM at 7:1
  { engine: 3, k: [0.45, 0.6, 0.45, 0.15], a: 0.4, d: 1, s: 0.7, r: 1.5 }, // PAD: detuned saws
  { engine: 0, k: [0.25, 0.3, 0.3, 0.45], a: 0.002, d: 0.35, s: 0.3, r: 0.2 }, // BASS: saw + square
]
/** The kit's TUNE / DECAY / TONE / LEVEL for its eight sounds. */
const KIT = Float64Array.from([
  0.3, 0.4, 0.6, 0.8, 0.35, 0.4, 0.5, 0.6, 0.4, 0.35, 0.4, 0.5, 0.5, 0.3, 0.5, 0.45, 0.5, 0.35, 0.5, 0.4, 0.4, 0.4, 0.4, 0.6, 0.5, 0.3, 0.6, 0.5, 0.4, 0.3, 0.6, 0.4,
])
/** Per layer: a column chord of five, or tails overlapping (the oldest goes). */
const VOICES = 5

/** One layer's instrument: a small voice pool (oldest note stolen) and a kit. */
export class LayerSound {
  private readonly voices: Voice[]
  private readonly drums: SketchDrums
  private readonly knobs = new Float64Array(4)
  private born = 0
  private snd = 0
  private kitUsed = false

  constructor(private readonly fs: number, rng: Rng) {
    this.voices = Array.from({ length: VOICES }, () => new Voice(fs, rng))
    this.drums = new SketchDrums(fs, rng)
  }

  /** Play a note (volts) or, on DRUMS, drum `drum`; it lets go after `hold` samples. */
  play(snd: number, volts: number, drum: number, vel: number, hold: number): void {
    if (snd === DRUMS) {
      this.kitUsed = true
      this.drums.trigger(drum, vel)
      return
    }
    this.snd = snd
    const s = SOUNDS[snd]
    for (let i = 0; i < 4; i++) this.knobs[i] = s.k[i]
    let v = this.voices[0]
    for (const x of this.voices) {
      if (!x.sounding) {
        v = x
        break
      }
      if (x.born < v.born) v = x
    }
    v.start(volts, vel, hold, this.born++, this.knobs, this.fs)
  }

  /** One sample of everything sounding (≈ ±1). */
  step(snd: number): number {
    // the kit only runs once this layer has played it
    let y = this.kitUsed ? this.drums.step(KIT, 0) : 0
    // notes still ringing after a switch to DRUMS keep their sound
    if (snd !== DRUMS) this.snd = snd
    const s = SOUNDS[this.snd] ?? SOUNDS[0]
    for (let i = 0; i < 4; i++) this.knobs[i] = s.k[i]
    for (const v of this.voices) {
      if (v.hold > 0 && --v.hold === 0) v.gate = 0
      if (!v.sounding) continue
      const e = v.env.step(v.gate, v.age === 0, s.a, s.d, s.s, s.r)
      y += render(v, s.engine, this.knobs, e, this.fs, 0) * e * v.vel
    }
    return y
  }
}
