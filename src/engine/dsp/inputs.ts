import type { ModuleSpec } from '../../modules/types'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { externalSample } from './external'
import { DECIM, HOP, Yin } from './tune'
import { C4 } from './util'

/** AUDIO IN: the interface's input (±1 full scale → ±5 V × GAIN), with an
 *  envelope follower, a threshold gate and a YIN pitch tracker. */
export class AudioInDsp extends Dsp {
  private readonly pGain = this.pi('gain')
  private readonly pThresh = this.pi('thresh')
  private readonly yin: Yin
  private env = 0
  private lp = 0
  private dec = 0
  private decN = 0
  private hop = 0
  private pitch = 0
  private voiced = false
  private gate = false

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.yin = new Yin(Math.floor(fs / DECIM / 1000), Math.ceil(fs / DECIM / 60))
  }

  tick(): void {
    const g = this.p[this.pGain] * 5
    const l = externalSample(0) * g
    const r = externalSample(1) * g
    const a = Math.abs((l + r) * 0.5)
    this.env += (a - this.env) * (a > this.env ? 0.01 : 0.0004)
    const th = this.p[this.pThresh]
    this.gate = this.gate ? this.env > th * 0.7 : this.env > th // hysteresis
    this.lp += ((l + r) * 0.5 - this.lp) * 0.35
    this.dec += this.lp
    if (++this.decN >= DECIM) {
      this.yin.push(this.dec / DECIM)
      this.dec = 0
      this.decN = 0
      if (++this.hop >= HOP) {
        this.hop = 0
        const period = this.gate ? this.yin.detect() : 0
        this.voiced = period > 0
        if (this.voiced) this.pitch = Math.log2(this.fs / DECIM / period / C4)
      }
    }
    const o = this.out
    o[0] = l
    o[1] = r
    o[2] = Math.min(10, this.env * 2)
    o[3] = this.gate ? 10 : 0
    o[4] = this.pitch
    this.led[0] = Math.min(1, this.env / 5)
    this.led[1] = this.voiced ? 1 : 0
    this.led[2] = this.pitch
  }
}

/** CAMERA: readings from the page's motion analysis, slewed into CV. */
export class CameraDsp extends Dsp {
  private readonly pSens = this.pi('sens')
  private readonly pSlew = this.pi('slew')
  private readonly goal = new Float64Array(4)
  private move = false

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'cam') {
      this.goal[0] = Math.min(10, ev.x * 10 * this.p[this.pSens])
      this.goal[3] = ev.y * 10
    } else if (ev.name === 'campos') {
      this.goal[1] = ev.x * 10
      this.goal[2] = ev.y * 10
    }
  }

  tick(): void {
    const k = 1 - Math.exp(-1 / (this.p[this.pSlew] * this.fs))
    const o = this.out
    o[0] += (this.goal[0] - o[0]) * k
    o[1] += (this.goal[1] - o[1]) * k
    o[2] += (this.goal[2] - o[2]) * k
    o[3] += (this.goal[3] - o[3]) * k
    this.move = this.move ? o[0] > 0.7 : o[0] > 1.2
    o[4] = this.move ? 10 : 0
    this.led[0] = o[0] / 10
  }
}

/** GAMEPAD: sticks ±5 V, triggers 0–10 V, buttons as gates. */
export class GamepadDsp extends Dsp {
  private readonly pSlew = this.pi('slew')
  private readonly goal = new Float64Array(6)
  private readonly buttons = new Uint8Array(6)

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'surface') return
    if (ev.name === 'stickL') {
      this.goal[0] = ev.x * 5
      this.goal[1] = ev.y * 5
    } else if (ev.name === 'stickR') {
      this.goal[2] = ev.x * 5
      this.goal[3] = ev.y * 5
    } else if (ev.name === 'triggers') {
      this.goal[4] = ev.x * 10
      this.goal[5] = ev.y * 10
    } else if (ev.name === 'btn') {
      const b = Math.round(ev.x)
      if (b >= 0 && b < 6) this.buttons[b] = ev.down ? 1 : 0
    }
  }

  tick(): void {
    const k = 1 - Math.exp(-1 / (this.p[this.pSlew] * this.fs))
    const o = this.out
    for (let i = 0; i < 6; i++) o[i] += (this.goal[i] - o[i]) * k
    for (let i = 0; i < 6; i++) o[6 + i] = this.buttons[i] ? 10 : 0
  }
}
