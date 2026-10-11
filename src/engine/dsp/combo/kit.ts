import type { Genre } from '../../../modules/specs/combo/genres'
import { C, H, K, O, P, R, S, T, X } from './fills'

type KitName = Genre['kit']
type PercName = Genre['perc']

/** How each kit is tuned: kick pitch / sweep / decay, snare tone and
 *  noise, hat decay, and how much room tail. */
const KITS: Record<KitName, { kick: [number, number, number]; snare: [number, number, number]; hat: number; room: number; brush?: boolean }> = {
  ACOUSTIC: { kick: [58, 3, 0.32], snare: [190, 0.55, 0.16], hat: 0.045, room: 0.12 },
  ROOM: { kick: [55, 3.5, 0.42], snare: [175, 0.65, 0.24], hat: 0.05, room: 0.3 },
  TIGHT: { kick: [62, 4, 0.18], snare: [210, 0.6, 0.12], hat: 0.035, room: 0.08 },
  JAZZ: { kick: [72, 2, 0.28], snare: [230, 0.5, 0.2], hat: 0.05, room: 0.1, brush: true },
  MACHINE: { kick: [48, 2.5, 0.65], snare: [200, 0.75, 0.14], hat: 0.03, room: 0.05 },
}
const TOMS = [210, 155, 110]

/** One decaying voice: an envelope, a phase, a pitch that glides down. */
class Hit {
  env = 0
  decay = 0
  ph = 0
  f = 0
  fEnd = 0
  glide = 0
  level = 0
  /** Samples since the hit (for the clap's stutter). */
  age = 0
}

/** COMBO's own drum kit: synthesised, tuned by the genre's kit (acoustic,
 *  a big room, tight metal, a jazz kit with brushes, a drum machine) and
 *  percussion (tambourine, shaker, clap, conga, rim). Mono. */
export class DrumKit {
  private readonly v = Array.from({ length: 9 }, () => new Hit())
  private kit = KITS.ACOUSTIC
  private perc: PercName = 'TAMB'
  private noiseLp = 0
  private hpS = 0
  private hpH = 0
  private hpHx = 0
  private bpR = 0
  private bpR2 = 0
  private rng = 0x2545f491
  private room = 0
  private roomLp = 0
  private readonly roomBuf: Float32Array
  private roomAt = 0

  constructor(private readonly fs: number) {
    this.roomBuf = new Float32Array(Math.round(fs * 0.045))
  }

  setGenre(kit: KitName, perc: PercName): void {
    this.kit = KITS[kit]
    this.perc = perc
  }

  private noise(): number {
    this.rng ^= this.rng << 13
    this.rng ^= this.rng >>> 17
    this.rng ^= this.rng << 5
    return (this.rng >>> 0) / 2147483648 - 1
  }

  private setDecay(h: Hit, s: number): void {
    h.decay = Math.exp(-1 / (Math.max(0.005, s) * this.fs))
  }

  /** Strike slot `slot` (fills.ts numbering) at velocity `vel`; `tom` 0..2. */
  hit(slot: number, vel: number, tom: number): void {
    const v = this.v[slot]
    const k = this.kit
    v.env = vel
    v.level = vel
    v.ph = 0
    v.age = 0
    switch (slot) {
      case K:
        v.f = k.kick[0] * k.kick[1]
        v.fEnd = k.kick[0]
        v.glide = Math.exp(-1 / (0.035 * this.fs))
        this.setDecay(v, k.kick[2])
        break
      case S:
        v.f = k.snare[0]
        this.setDecay(v, k.brush ? 0.28 : k.snare[2])
        break
      case H:
        this.setDecay(v, k.hat)
        this.v[O].env *= 0.05 // closing the hat chokes the open one
        break
      case O:
        this.setDecay(v, 0.4)
        break
      case R:
        this.setDecay(v, 1.4)
        v.f = 520
        break
      case C:
        this.setDecay(v, 1.9)
        break
      case T:
        v.f = TOMS[Math.max(0, Math.min(2, tom))] * 1.35
        v.fEnd = TOMS[Math.max(0, Math.min(2, tom))]
        v.glide = Math.exp(-1 / (0.06 * this.fs))
        this.setDecay(v, 0.38)
        break
      case P:
        v.f = this.perc === 'CONGA' ? 330 : 1700
        this.setDecay(v, this.perc === 'TAMB' ? 0.16 : this.perc === 'SHAKER' ? 0.07 : this.perc === 'CLAP' ? 0.11 : this.perc === 'CONGA' ? 0.22 : 0.035)
        break
      case X:
        v.f = 2600
        this.setDecay(v, 0.025)
        break
    }
  }

  /** One sample of the kit. */
  step(): number {
    const fs = this.fs
    const n = this.noise()
    this.noiseLp += (n - this.noiseLp) * 0.5
    let y = 0
    const v = this.v
    // kick: a sine falling to its pitch, with a click of noise at the front
    let h = v[K]
    if (h.env > 1e-4) {
      h.f = h.fEnd + (h.f - h.fEnd) * h.glide
      h.ph += h.f / fs
      y += Math.sin(2 * Math.PI * h.ph) * h.env * 1.1 + n * h.env * h.env * h.env * 0.25
      h.env *= h.decay
    }
    // snare: two drum-head tones under a burst of the wires (or a brush's swish)
    h = v[S]
    if (h.env > 1e-4) {
      h.ph += h.f / fs
      this.hpS += (n - this.hpS) * 0.25
      const wires = n - this.hpS
      const tone = this.kit.brush ? 0 : (Math.sin(2 * Math.PI * h.ph) + 0.6 * Math.sin(2 * Math.PI * h.ph * 1.74)) * h.env * h.env * 0.45
      y += tone + wires * h.env * this.kit.snare[1] * (this.kit.brush ? 0.45 : 1)
      h.env *= h.decay
    }
    // hats: high-passed noise, short (closed) or ringing (open)
    this.hpH += (n - this.hpH) * 0.6
    const hiss = n - this.hpH
    h = v[H]
    if (h.env > 1e-4) {
      y += hiss * h.env * 0.32
      h.env *= h.decay
    }
    h = v[O]
    if (h.env > 1e-4) {
      y += hiss * h.env * 0.32
      h.env *= h.decay
    }
    // ride and crash: a metallic ring (noise through a narrow band) and a bell
    h = v[R]
    if (h.env > 1e-4) {
      h.ph += h.f / fs
      this.bpR += (hiss - this.bpR) * 0.35
      y += (this.bpR * 0.22 + Math.sin(2 * Math.PI * h.ph) * Math.sin(2 * Math.PI * h.ph * 2.76) * 0.05) * h.env
      h.env *= h.decay
    }
    h = v[C]
    if (h.env > 1e-4) {
      this.bpR2 += (hiss - this.bpR2) * 0.5
      y += this.bpR2 * h.env * 0.35
      h.env *= h.decay
    }
    // toms: a pitched sine that settles
    h = v[T]
    if (h.env > 1e-4) {
      h.f = h.fEnd + (h.f - h.fEnd) * h.glide
      h.ph += h.f / fs
      y += Math.sin(2 * Math.PI * h.ph) * h.env * 0.8 + this.noiseLp * h.env * h.env * 0.1
      h.env *= h.decay
    }
    // percussion, per genre
    h = v[P]
    if (h.env > 1e-4) {
      h.ph += h.f / fs
      if (this.perc === 'CONGA') y += Math.sin(2 * Math.PI * h.ph) * h.env * 0.6
      else if (this.perc === 'RIM') y += (Math.sin(2 * Math.PI * h.ph) * 0.4 + hiss * 0.3) * h.env
      else if (this.perc === 'CLAP') {
        // a clap is a few hands just apart: the envelope stutters at the front
        const age = h.age++
        const stutter = age < fs * 0.03 ? (Math.floor(age / (fs * 0.009)) % 2 === 0 ? 1 : 0.35) : 1
        this.hpHx += (n - this.hpHx) * 0.2
        y += (n - this.hpHx) * h.env * stutter * 0.5
      } else y += hiss * h.env * (this.perc === 'TAMB' ? 0.35 + 0.2 * Math.sin(2 * Math.PI * h.ph * 3.1) : 0.25)
      h.env *= h.decay
    }
    // the count-in's sticks
    h = v[X]
    if (h.env > 1e-4) {
      h.ph += h.f / fs
      y += Math.sin(2 * Math.PI * h.ph) * h.env * 0.35
      h.env *= h.decay
    }
    // a little room: one short reflection, darkened
    const back = this.roomBuf[this.roomAt]
    this.roomLp += (back - this.roomLp) * 0.3
    this.roomBuf[this.roomAt] = y + this.roomLp * 0.35
    this.roomAt = (this.roomAt + 1) % this.roomBuf.length
    this.room = this.roomLp
    return y + this.room * this.kit.room
  }
}
