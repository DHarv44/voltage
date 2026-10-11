import { Biquad } from '../biquad'
import { Dsp } from '../base'
import { Schmitt } from '../cores'
import { DelayLine } from '../delayLine'
import { fastTanh, TAU } from '../util'

/** Rotor speeds (Hz): horn and drum, SLOW and FAST. */
const HORN = [0.83, 6.7]
const DRUM = [0.7, 5.7]
/** How long each motor takes to speed up / slow down (s): the horn is light, the drum heavy. */
const HORN_UP = 0.7
const HORN_DOWN = 1.1
const DRUM_UP = 3.5
const DRUM_DOWN = 4.5
/** The horn mouth's radius as a delay (s): the Doppler swing. */
const HORN_R = 0.00045
const DRUM_R = 0.00012
const BASE = 0.0015

/** ROTARY: the signal through a valve preamp, split at 800 Hz: the highs go
 *  to the spinning horn (Doppler pitch swing as it comes and goes, and it's
 *  loudest pointing at a microphone), the lows to the spinning drum (mostly
 *  a throb). Two mics, MIC SPREAD apart, make the stereo. The motors take
 *  their time between SLOW and FAST: the famous ramp. */
export class RotaryDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly iFast = this.ii('fast')
  private readonly oL = this.oi('l')
  private readonly oR = this.oi('r')
  private readonly P = { speed: this.pi('speed'), drive: this.pi('drive'), bal: this.pi('balance'), spread: this.pi('spread'), mix: this.pi('mix') }
  private readonly lo: Biquad
  private readonly hi: Biquad
  private readonly hornTone: Biquad
  private readonly horn: DelayLine
  private readonly drum: DelayLine
  private readonly fast = new Schmitt()
  private hHz = HORN[0]
  private dHz = DRUM[0]
  private hTh = 0
  private dTh = 0

  constructor(...args: ConstructorParameters<typeof Dsp>) {
    super(...args)
    this.lo = new Biquad(this.fs).lowpass(800, 0.6)
    this.hi = new Biquad(this.fs).highpass(800, 0.6)
    this.hornTone = new Biquad(this.fs).lowpass(7000, 0.7)
    this.horn = new DelayLine(Math.ceil(0.01 * this.fs))
    this.drum = new DelayLine(Math.ceil(0.01 * this.fs))
    this.hTh = this.rng.next() * TAU
    this.dTh = this.rng.next() * TAU
  }

  /** A motor easing toward its target speed. */
  private ease(hz: number, target: number, up: number, down: number): number {
    const t = target > hz ? up : down
    return hz + (target - hz) * (1 - Math.exp(-1 / (t * this.fs)))
  }

  tick(): void {
    const p = this.p
    const x = this.in[this.iIn]
    let sp = Math.round(p[this.P.speed])
    if (this.patched[this.iFast]) {
      this.fast.rise(this.in[this.iFast])
      sp = this.fast.high ? 2 : 1
    }
    this.hHz = this.ease(this.hHz, sp === 0 ? 0 : HORN[sp - 1], HORN_UP, HORN_DOWN)
    this.dHz = this.ease(this.dHz, sp === 0 ? 0 : DRUM[sp - 1], DRUM_UP, DRUM_DOWN)
    this.hTh = (this.hTh + (TAU * this.hHz) / this.fs) % TAU
    this.dTh = (this.dTh + (TAU * this.dHz) / this.fs) % TAU
    // the valve preamp
    const d = p[this.P.drive]
    const pre = (5 * fastTanh((x / 5) * (1 + d * 6))) / (1 + d * 1.5)
    this.horn.write(this.hornTone.run(this.hi.run(pre)))
    this.drum.write(this.lo.run(pre))
    // the two mics, either side of the cabinet
    const phi = (p[this.P.spread] * Math.PI) / 2
    const fs = this.fs
    const hsL = Math.sin(this.hTh - phi)
    const hsR = Math.sin(this.hTh + phi)
    const hL = this.horn.tapLin((BASE + HORN_R * hsL) * fs) * (0.55 + 0.45 * Math.cos(this.hTh - phi))
    const hR = this.horn.tapLin((BASE + HORN_R * hsR) * fs) * (0.55 + 0.45 * Math.cos(this.hTh + phi))
    const dL = this.drum.tapLin((BASE + DRUM_R * Math.sin(this.dTh - phi)) * fs) * (0.75 + 0.25 * Math.cos(this.dTh - phi))
    const dR = this.drum.tapLin((BASE + DRUM_R * Math.sin(this.dTh + phi)) * fs) * (0.75 + 0.25 * Math.cos(this.dTh + phi))
    const b = p[this.P.bal]
    const hg = Math.min(1, 2 * b) * 1.2
    const dg = Math.min(1, 2 * (1 - b)) * 1.2
    const mix = p[this.P.mix]
    this.out[this.oL] = x * (1 - mix) + (hL * hg + dL * dg) * mix
    this.out[this.oR] = x * (1 - mix) + (hR * hg + dR * dg) * mix
    this.led[0] = 0.5 + 0.5 * Math.cos(this.hTh)
    this.led[1] = 0.5 + 0.5 * Math.cos(this.dTh)
  }
}
