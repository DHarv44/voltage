import { Dsp, MAX_VOICES } from './base'
import { midiOut } from './external'

/** SEND: passes IN through to THRU and holds it for the RECEIVEs. */
export class SendDsp extends Dsp {
  private readonly iIn = this.ii('in')
  private readonly oThru = this.oi('thru')
  private readonly pCh = this.pi('ch')
  /** Voices arriving this sample. */
  n = 1
  private env = 0

  get channel(): number {
    return Math.round(this.p[this.pCh])
  }

  /** Voice v as it arrived this sample. */
  voice(v: number): number {
    return this.polyOut[this.oThru]![v]
  }

  tick(): void {
    const n = (this.n = this.inChans(this.iIn))
    for (let v = 0; v < n; v++) this.pout(this.oThru, v, this.pin(this.iIn, v))
    this.chans[this.oThru] = n
    const a = Math.abs(this.out[this.oThru]) / 5
    this.env = a > this.env ? a : this.env * 0.9995
    this.led[0] = Math.min(1, this.env)
  }
}

/** RECEIVE: the sum of the SENDs on its channel (linked at each patch rebuild,
 *  and run after them, so it's this sample's value unless a loop makes it the last). */
export class RecvDsp extends Dsp {
  private readonly oOut = this.oi('out')
  private readonly pCh = this.pi('ch')
  private senders: SendDsp[] = []
  private env = 0

  link(mods: Dsp[]): void {
    this.senders = mods.filter((m): m is SendDsp => m instanceof SendDsp)
    this.deps = this.senders
  }

  tick(): void {
    const ch = Math.round(this.p[this.pCh])
    const po = this.polyOut[this.oOut]!
    po.fill(0)
    let n = 1
    for (let k = 0; k < this.senders.length; k++) {
      const s = this.senders[k]
      if (s.channel !== ch) continue
      if (s.n > n) n = s.n
      for (let v = 0; v < s.n; v++) po[v] += s.voice(v)
    }
    this.chans[this.oOut] = n
    this.out[this.oOut] = po[0]
    const a = Math.abs(po[0]) / 5
    this.env = a > this.env ? a : this.env * 0.9995
    this.led[0] = Math.min(1, this.env)
  }
}

const CC_EVERY_S = 0.005

/** MIDI OUT: each voice of GATE starts a note at its V/OCT (nearest semitone)
 *  and ends it when the gate falls; the CC inputs are sent when they move. */
export class MidiOutDsp extends Dsp {
  private readonly iV = this.ii('voct')
  private readonly iGate = this.ii('gate')
  private readonly iVel = this.ii('vin')
  private readonly iA = this.ii('cva')
  private readonly iB = this.ii('cvb')
  private readonly P = { ch: this.pi('ch'), cc1: this.pi('cc1'), cc2: this.pi('cc2'), vel: this.pi('vel') }
  private readonly note = new Int16Array(MAX_VOICES).fill(-1)
  private readonly sentCh = new Int8Array(MAX_VOICES)
  private readonly last = new Int16Array(2).fill(-1)
  private ccWait = 0
  private flash = 0

  private send3(a: number, b: number, c: number): void {
    midiOut.push(a)
    midiOut.push(b)
    midiOut.push(c)
  }

  tick(): void {
    const p = this.p
    const ch = Math.round(p[this.P.ch]) & 15
    const n = this.patched[this.iGate] ? this.inChans(this.iGate) : 0
    for (let v = 0; v < MAX_VOICES; v++) {
      const g = v < n && this.pin(this.iGate, v) > 1
      if (g && this.note[v] < 0) {
        const note = Math.max(0, Math.min(127, Math.round(60 + this.pin(this.iV, v) * 12)))
        const vel = this.patched[this.iVel] ? Math.max(1, Math.min(127, Math.round((this.pin(this.iVel, v) / 10) * 127))) : Math.round(p[this.P.vel])
        this.send3(0x90 | ch, note, vel)
        this.note[v] = note
        this.sentCh[v] = ch
        this.flash = Math.round(0.05 * this.fs)
      } else if (!g && this.note[v] >= 0) {
        this.send3(0x80 | this.sentCh[v], this.note[v], 0)
        this.note[v] = -1
      }
    }
    // controllers, at most every 5 ms and only when the value changes
    if (--this.ccWait <= 0) {
      this.ccWait = Math.round(CC_EVERY_S * this.fs)
      for (let k = 0; k < 2; k++) {
        const jack = k === 0 ? this.iA : this.iB
        if (!this.patched[jack]) continue
        const val = Math.max(0, Math.min(127, Math.round((this.in[jack] / 10) * 127)))
        if (val !== this.last[k]) {
          this.last[k] = val
          this.send3(0xb0 | ch, Math.round(p[k === 0 ? this.P.cc1 : this.P.cc2]), val)
        }
      }
    }
    if (this.flash > 0) this.flash--
    this.led[0] = this.flash > 0 ? 1 : 0
  }
}
