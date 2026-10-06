import { ARP, DRIFT, PATTERN, SB_ARP_MAX, SB_BALLS, SB_STEPS, TUMBLE } from '../../../modules/specs/sketchbook'
import type { Rng } from '../util'
import { TumbleCore } from '../tumbleCore'

/** Whoever plays the notes the sequencer decides on. */
export interface Player {
  /** A note: volts, velocity 0..1, how long (samples). */
  play(volts: number, vel: number, hold: number): void
  /** Pattern note number → volts (keybed numbering, with OCTAVE). */
  volts(note: number): number
}

/** Steps per ARP rate (1/4 … 1/32, in 16ths). */
const ARP_EVERY = [4, 2, 1, 0.5]
/** Physics substep for TUMBLE (s), and its gravity at 1. */
const TUMBLE_DT = 1 / 3000
const G = 4
const TAU = Math.PI * 2
/** DRIFT moves notes along the minor pentatonic (keybed semitones). */
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]

/** SKETCHBOOK's sequencer: the four types (see SB_SEQS). */
export class SketchSeq {
  step = -1
  /** The drifting copy of the pattern (DRIFT plays this, not the params). */
  readonly drift = new Float32Array(SB_STEPS).fill(-1)
  private drifting = false
  /** Keys held for the arpeggio (volts, in the order pressed), and where it is. */
  readonly held = new Float32Array(SB_ARP_MAX)
  heldCount = 0
  arpAt = 0
  private arpUp = true
  private arpWait = 0
  readonly drum: TumbleCore
  private tumbleAcc = 0
  private notes: Float64Array | null = null
  private nBase = 0
  private tumbleHold = 0

  constructor(
    private readonly rng: Rng,
    private readonly player: Player,
  ) {
    this.drum = new TumbleCore(SB_BALLS, rng)
    this.drum.onHit = (wall, speed) => this.tumbleHit(wall, speed)
  }

  /** ARP: a key went down / up. */
  hold(volts: number, down: boolean): void {
    if (down) {
      if (this.heldCount < SB_ARP_MAX) this.held[this.heldCount++] = volts
      return
    }
    let j = 0
    for (let i = 0; i < this.heldCount; i++) if (Math.abs(this.held[i] - volts) > 1e-6) this.held[j++] = this.held[i]
    this.heldCount = j
    if (this.arpAt >= this.heldCount) this.arpAt = 0
  }

  /** Copy the pattern into the drifting copy (DRIFT starts from what you wrote). */
  private startDrift(notes: Float64Array, base: number): void {
    for (let i = 0; i < SB_STEPS; i++) this.drift[i] = notes[base + i]
    this.drifting = true
  }

  /** A step of the clock (a 16th). `p` / `nBase` are the params and where the
   *  pattern's notes start; `stepLen` is the step's length (s). */
  onStep(type: number, p: Float64Array, nBase: number, len: number, glen: number, change: number, stepLen: number, fs: number): void {
    this.step = (this.step + 1) % Math.max(1, len)
    if (type !== DRIFT) this.drifting = false
    if (type === PATTERN || type === DRIFT) {
      if (type === DRIFT) {
        if (!this.drifting) this.startDrift(p, nBase)
        // once round, each step may move to a neighbouring note (or rest / come back)
        if (this.step === 0) for (let i = 0; i < len; i++) if (this.rng.next() < change * 0.5) this.mutate(i)
      }
      const note = Math.round(type === DRIFT ? this.drift[this.step] : p[nBase + this.step])
      if (note >= 0) this.player.play(this.player.volts(note), 0.85, Math.round(glen * stepLen * fs))
    }
  }

  private mutate(i: number): void {
    const n = this.drift[i]
    if (n < 0 || this.rng.next() < 0.12) {
      this.drift[i] = n < 0 ? PENTA[Math.floor(this.rng.next() * 6)] : -1
      return
    }
    let at = 0
    for (let k = 0; k < PENTA.length; k++) if (Math.abs(PENTA[k] - n) < Math.abs(PENTA[at] - n)) at = k
    at = Math.max(0, Math.min(PENTA.length - 1, at + (this.rng.next() < 0.5 ? -1 : 1)))
    this.drift[i] = PENTA[at]
  }

  /** ARP: called every sample while keys are held; plays on its own grid. */
  arpTick(rate: number, octaves: number, mode: number, stepLen: number, fs: number): void {
    if (this.heldCount === 0) {
      this.arpWait = 0
      return
    }
    if (--this.arpWait > 0) return
    const every = ARP_EVERY[rate] ?? 1
    this.arpWait = Math.max(1, Math.round(every * stepLen * fs))
    const n = this.heldCount * octaves
    let at: number
    if (mode === 3) at = Math.floor(this.rng.next() * n)
    else if (mode === 2 && n > 1) {
      at = this.arpAt
      this.arpAt += this.arpUp ? 1 : -1
      if (this.arpAt >= n - 1) this.arpUp = false
      if (this.arpAt <= 0) this.arpUp = true
    } else {
      at = mode === 1 ? n - 1 - (this.arpAt % n) : this.arpAt % n
      this.arpAt = (this.arpAt + 1) % n
    }
    // notes low to high: the k-th lowest held key, repeated up the octaves
    this.player.play(this.lowest(at % this.heldCount) + Math.floor(at / this.heldCount), 0.85, Math.round(every * stepLen * fs * 0.7))
  }

  /** The k-th lowest held note (volts). */
  private lowest(k: number): number {
    for (let i = 0; i < this.heldCount; i++) {
      let below = 0
      for (let j = 0; j < this.heldCount; j++) if (this.held[j] < this.held[i]) below++
      if (below === k) return this.held[i]
    }
    return this.held[0]
  }

  /** TUMBLE: advance the drum by `dt` s; its walls are the first SIDES steps,
   *  and a wall hit plays that step's note for `hold` samples. */
  tumbleTick(dt: number, p: Float64Array, nBase: number, sides: number, spin: number, grav: number, balls: number, hold: number): void {
    this.notes = p
    this.nBase = nBase
    this.tumbleHold = hold
    this.tumbleAcc += dt
    while (this.tumbleAcc >= TUMBLE_DT) {
      this.tumbleAcc -= TUMBLE_DT
      this.drum.step(TUMBLE_DT, sides, spin * TAU, G * grav, 0.75, balls)
    }
  }

  private tumbleHit(wall: number, speed: number): void {
    const note = this.notes ? Math.round(this.notes[this.nBase + wall]) : -1
    if (note >= 0) this.player.play(this.player.volts(note), Math.min(1, 0.4 + speed / 4), this.tumbleHold)
  }
}
