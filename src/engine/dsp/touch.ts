import { Dsp } from './base'
import type { UiEvent } from '../protocol'

const PLATES = 4

/** Touch plates. Each plate gives a gate while touched; PRESSURE and POSITION
 *  follow the most recent touch (slewed like a real capacitive plate's
 *  response), and PITCH steps by INTERVAL semitones per plate. */
export class TouchDsp extends Dsp {
  private pInterval = this.pi('interval')
  private pSlew = this.pi('slew')
  private readonly held = new Uint8Array(PLATES)
  private last = 0
  private presTarget = 0
  private posTarget = 0
  private pres = 0
  private pos = 0

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'touch' || ev.index < 0 || ev.index >= PLATES) return
    this.held[ev.index] = ev.down ? 1 : 0
    if (ev.down) {
      this.last = ev.index
      this.presTarget = ev.y
      this.posTarget = ev.x
      this.led[ev.index] = 0.3 + 0.7 * ev.y
    } else {
      this.led[ev.index] = 0
      if (!this.held.some((h) => h === 1)) this.presTarget = 0 // lifting the finger releases pressure
    }
  }

  tick(): void {
    const k = 1 - Math.exp(-1 / (this.p[this.pSlew] * this.fs))
    this.pres += (this.presTarget - this.pres) * k
    this.pos += (this.posTarget - this.pos) * k
    const o = this.out
    let any = false
    for (let i = 0; i < PLATES; i++) {
      o[i] = this.held[i] ? 10 : 0
      any ||= this.held[i] === 1
    }
    o[PLATES] = this.pres * 10
    o[PLATES + 1] = this.pos * 10
    o[PLATES + 2] = (this.last * this.p[this.pInterval]) / 12
    o[PLATES + 3] = any ? 10 : 0
  }
}
