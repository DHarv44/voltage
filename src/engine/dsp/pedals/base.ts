import type { ModuleSpec } from '../../../modules/types'
import { Dsp } from '../base'

/** Guitar-pedal level: the rack's ±5 V audio is brought down to instrument
 *  level going in, and back up coming out, so the circuits clip where a real
 *  pedal would. */
export const PEDAL_IN = 0.2

/** A stompbox. The effect always runs (so echoes and loops keep their state);
 *  the footswitch crossfades between dry and wet in ~2 ms so stomping never
 *  clicks. Subclasses implement wet(). */
export abstract class PedalDsp extends Dsp {
  protected readonly iIn = this.ii('in')
  private readonly pOn = this.pi('on')
  /** How engaged the pedal is right now (0 bypassed … 1 on), crossfaded. */
  protected mix = 1
  private readonly stompK: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.stompK = 1 - Math.exp(-1 / (0.002 * fs))
  }

  /** Advance the footswitch crossfade; returns how engaged the pedal is (0..1). */
  protected engage(): number {
    this.mix += (this.p[this.pOn] - this.mix) * this.stompK
    return this.mix
  }

  /** Processed signal for input x (volts). */
  protected abstract wet(x: number): number

  tick(): void {
    const x = this.in[this.iIn]
    const m = this.engage()
    const y = this.wet(x)
    this.out[0] = x + (y - x) * m
  }
}

/** DC blocker (the coupling capacitor at a pedal's output). */
export class DcBlock {
  private x1 = 0
  private y1 = 0
  constructor(private readonly r: number) {}
  run(x: number): number {
    const y = x - this.x1 + this.r * this.y1
    this.x1 = x
    this.y1 = y
    return y
  }
}
