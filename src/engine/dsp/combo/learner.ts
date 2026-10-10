import { analyse, type Learned } from './analyse'

/** Longest a part can be taught (s): 48 bars at a slow 40 bpm in 4/4. */
const MAX_S = 300

/** What COMBO hears while it learns a part: one frame per HOP (a chroma, the
 *  bass's pitch classes, an onset strength, a level) from the audio listener,
 *  or built from the notes held on the cables. Kept until the part is
 *  analysed (see analyse.ts). Everything is allocated once, up front. */
export class Learner {
  readonly maxFrames: number
  readonly chroma: Float32Array
  readonly bass: Float32Array
  readonly flux: Float32Array
  readonly energy: Float32Array
  /** Scratch for the analysis (allocated with the rest): running sums of
   *  chroma, bass and level per frame, and the onset envelope. */
  readonly sumChroma: Float64Array
  readonly sumBass: Float64Array
  readonly sumEnergy: Float64Array
  readonly onset: Float32Array
  /** The frames came from cable notes (exact pitches) rather than a microphone. */
  fromCables = false
  frames = 0
  /** Samples since learning began (the part's exact length when it ends). */
  samples = 0
  learning = false
  /** Cable notes: pitch-class weights, the lowest note, and note starts
   *  gathered for the frame in progress. */
  private readonly acc = new Float64Array(12)
  private readonly accBass = new Float64Array(12)
  private lowest = Infinity
  private onsets = 0
  private accN = 0

  constructor(
    private readonly fs: number,
    readonly frameSec: number,
  ) {
    this.maxFrames = Math.ceil(MAX_S / frameSec)
    this.chroma = new Float32Array(this.maxFrames * 12)
    this.bass = new Float32Array(this.maxFrames * 12)
    this.flux = new Float32Array(this.maxFrames)
    this.energy = new Float32Array(this.maxFrames)
    this.sumChroma = new Float64Array((this.maxFrames + 1) * 12)
    this.sumBass = new Float64Array((this.maxFrames + 1) * 12)
    this.sumEnergy = new Float64Array(this.maxFrames + 1)
    this.onset = new Float32Array(this.maxFrames)
  }

  start(fromCables: boolean): void {
    this.fromCables = fromCables
    this.frames = 0
    this.samples = 0
    this.acc.fill(0)
    this.accBass.fill(0)
    this.lowest = Infinity
    this.onsets = this.accN = 0
    this.learning = true
  }

  /** Count a sample (call every sample while learning). False once it's too long. */
  tick(): boolean {
    this.samples++
    return this.frames < this.maxFrames
  }

  /** A frame from the audio listener (or the cables). */
  addFrame(chroma: ArrayLike<number>, bass: ArrayLike<number>, flux: number, energy: number): void {
    if (this.frames >= this.maxFrames) return
    const f = this.frames++
    for (let p = 0; p < 12; p++) {
      this.chroma[f * 12 + p] = chroma[p]
      this.bass[f * 12 + p] = bass[p]
    }
    this.flux[f] = flux
    this.energy[f] = energy
  }

  /** Cable notes for one sample: a held note `semis` (semitones, any octave),
   *  `start` when it begins on this sample. Call once per held note. */
  addNote(semis: number, start: boolean): void {
    this.acc[((Math.round(semis) % 12) + 12) % 12] += 1
    if (semis < this.lowest) this.lowest = semis
    if (start) this.onsets++
  }

  /** The end of a sample's cable notes; every `hop` samples it becomes a frame. */
  endSample(hop: number): void {
    if (this.lowest < Infinity) this.accBass[((Math.round(this.lowest) % 12) + 12) % 12] += 1
    this.lowest = Infinity
    if (++this.accN < hop) return
    let e = 0
    for (let p = 0; p < 12; p++) e += this.acc[p]
    if (e > 0) for (let p = 0; p < 12; p++) this.acc[p] = Math.log(1 + (this.acc[p] / hop) * 4)
    this.addFrame(this.acc, this.accBass, this.onsets * 3, e / hop)
    this.acc.fill(0)
    this.accBass.fill(0)
    this.onsets = this.accN = 0
  }

  /** Stop and work the part out. `meter` 3 or 4 holds it to that meter (a
   *  style chosen before teaching), 0 lets it decide. */
  finish(meter: number): Learned {
    this.learning = false
    return analyse(this, this.samples / this.fs, meter)
  }
}
