import { TAU } from './util'

/** One resonant mode as a rotating phasor (a damped sinusoid with no sin()
 *  per sample): the building block of struck and bowed objects. */
export class Mode {
  re = 0
  im = 0
  private c = 1
  private s = 0
  private g = 1

  tune(f: number, decaySec: number, fs: number): void {
    const w = (TAU * Math.min(f, fs * 0.45)) / fs
    this.c = Math.cos(w)
    this.s = Math.sin(w)
    this.g = Math.exp(-1 / (Math.max(0.005, decaySec) * fs))
  }

  /** Add energy: a strike sets the amplitude, a drive pushes it along. */
  strike(amp: number): void {
    this.re += amp
  }

  /** Push the mode with an input sample (bowing, rubbing, sympathetic drive). */
  drive(x: number): void {
    this.im += x
  }

  step(): number {
    const re = (this.re * this.c - this.im * this.s) * this.g
    this.im = (this.re * this.s + this.im * this.c) * this.g
    this.re = re
    return this.im
  }

  get energy(): number {
    return this.re * this.re + this.im * this.im
  }
}

export interface Partial {
  ratio: number
  amp: number
  /** Decay as a fraction of the note's decay time. */
  decay: number
}

/** A struck object: a set of modes tuned from a fundamental and a partial
 *  recipe. Silent voices cost nothing (step() skips them). */
export class ModalVoice {
  readonly modes: Mode[]
  private live = false
  constructor(private readonly recipe: Partial[]) {
    this.modes = recipe.map(() => new Mode())
  }

  tune(f: number, decaySec: number, fs: number, detune = 0): void {
    this.modes.forEach((m, k) => m.tune(f * this.recipe[k].ratio * (1 + detune * k), decaySec * this.recipe[k].decay, fs))
  }

  /** brightness 0..1 scales the upper partials (soft hand … hard stick). */
  strike(vel: number, brightness: number): void {
    this.modes.forEach((m, k) => m.strike(vel * this.recipe[k].amp * (k === 0 ? 1 : brightness)))
    this.live = true
  }

  step(): number {
    if (!this.live) return 0
    let y = 0
    let e = 0
    for (const m of this.modes) {
      y += m.step()
      e += m.energy
    }
    if (e < 1e-10) this.live = false
    return y
  }
}
