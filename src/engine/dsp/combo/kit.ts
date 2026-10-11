import type { Genre } from '../../../modules/specs/combo/genres'
import { Biquad } from '../biquad'
import { Rng } from '../util'
import { Drum, Metal, type HeadSpec, type MetalSpec } from './drumParts'
import { DrumRoom } from './drumRoom'
import { C, DRUM_SLOTS, H, K, O, P, R, S, T, X } from './fills'

type KitName = Genre['kit']
type PercName = Genre['perc']

const head = (f: number, decay: number, o: Partial<HeadSpec> = {}): HeadSpec => ({ f, decay, modes: 8, centre: 0.6, bend: 0.08, bendTime: 0.03, click: 0.4, clickHz: 3500, ...o })
const metal = (bands: number[], q: number, hp: number, o: Partial<MetalSpec> = {}): MetalSpec => ({ bands, q, hp, bell: 0, bellLevel: 0, attack: 0, ...o })

const HATS = metal([3150, 4950, 6650, 8200, 10400, 12700], 5, 3500)
const RIDE = metal([2600, 3900, 5300, 7100, 9000, 11200], 6, 1800, { bell: 470, bellLevel: 0.22 })
const CRASH = metal([1900, 2800, 4100, 5600, 7500, 9800, 12600], 3, 1300, { bell: 330, bellLevel: 0.03, attack: 0.012 })

interface KitDef {
  kick: HeadSpec
  snare: HeadSpec
  /** The snare wires: level, decay (s), band (Hz); brushes swish in instead of snapping. */
  wires: [number, number, number, number]
  brush?: boolean
  toms: HeadSpec[]
  hats: MetalSpec
  /** Closed and open hat decays (s), ride and crash decays (s). */
  hat: [number, number]
  ride: number
  crash: number
  /** How much room, and how big it is. */
  room: number
  size: number
}

const toms = (hi: number, o: Partial<HeadSpec> = {}) => [hi, hi * 0.75, hi * 0.5].map((f, i) => head(f, 0.45 + 0.12 * i, { centre: 0.7, bend: 0.1, bendTime: 0.06, click: 0.3, clickHz: 3000, modes: 6, ...o }))

/** Each kit, tuned and damped as a drummer would for the genre. */
const KITS: Record<KitName, KitDef> = {
  ACOUSTIC: { kick: head(56, 0.17, { modes: 6, centre: 0.85, bend: 0.12, bendTime: 0.025, click: 0.6, clickHz: 3200 }), snare: head(195, 0.12, { centre: 0.55, bend: 0.06, bendTime: 0.02, click: 0.6, clickHz: 4500 }), wires: [1.7, 0.16, 1800, 9000], toms: toms(196), hats: HATS, hat: [0.06, 0.7], ride: 2.4, crash: 2, room: 0.3, size: 0.45 },
  ROOM: { kick: head(52, 0.24, { modes: 6, centre: 0.8, bend: 0.15, bendTime: 0.03, click: 0.5, clickHz: 2800 }), snare: head(180, 0.16, { centre: 0.5, bend: 0.07, click: 0.6, clickHz: 4000 }), wires: [1.8, 0.2, 1600, 8500], toms: toms(180), hats: HATS, hat: [0.07, 0.8], ride: 2.8, crash: 2.6, room: 0.55, size: 0.8 },
  TIGHT: { kick: head(60, 0.1, { modes: 6, centre: 0.9, bend: 0.1, bendTime: 0.015, click: 1, clickHz: 4500 }), snare: head(215, 0.09, { centre: 0.6, bend: 0.05, click: 0.7, clickHz: 5000 }), wires: [1.5, 0.12, 2000, 10000], toms: toms(210, { bend: 0.12 }), hats: HATS, hat: [0.045, 0.55], ride: 2, crash: 1.8, room: 0.15, size: 0.3 },
  JAZZ: { kick: head(70, 0.28, { modes: 6, centre: 0.6, bend: 0.05, click: 0.3, clickHz: 2200 }), snare: head(240, 0.14, { centre: 0.45, bend: 0.03, click: 0, clickHz: 4000 }), wires: [0.8, 0.3, 1500, 7500], brush: true, toms: toms(220, { click: 0.15 }), hats: HATS, hat: [0.07, 0.9], ride: 3.2, crash: 2.4, room: 0.3, size: 0.5 },
  MACHINE: { kick: head(50, 0.55, { modes: 1, bend: 1.6, bendTime: 0.03, click: 0.15, clickHz: 1800 }), snare: head(200, 0.1, { modes: 2, centre: 0.5, bend: 0.15, bendTime: 0.01, click: 0, clickHz: 3000 }), wires: [2, 0.14, 1500, 11000], toms: toms(170, { modes: 1, bend: 0.4 }), hats: metal([3400, 5200, 7600, 10500], 9, 6000), hat: [0.04, 0.45], ride: 2, crash: 1.8, room: 0.08, size: 0.25 },
}

const PERC: Record<PercName, { drum?: HeadSpec; metal?: MetalSpec; decay: number }> = {
  TAMB: { metal: metal([5600, 7300, 9100, 11000], 9, 4500, { attack: 0.002 }), decay: 0.2 },
  SHAKER: { metal: metal([4800, 7000], 1.3, 3000, { attack: 0.012 }), decay: 0.07 },
  CLAP: { decay: 0.11 },
  CONGA: { drum: head(330, 0.28, { modes: 6, centre: 0.35, bend: 0.04, click: 0.35, clickHz: 2500 }), decay: 0 },
  RIM: { drum: head(520, 0.06, { modes: 4, centre: 0.1, bend: 0, click: 0.9, clickHz: 2200 }), decay: 0 },
}
const STICKS = head(2100, 0.04, { modes: 3, centre: 0.3, bend: 0, click: 0.6 })

/** Where each drum sits (−1 left … 1 right, drummer's view), and how late
 *  each tends to land (ms: the snare a touch behind, the hats loose). */
const PAN = [0, 0.05, -0.3, -0.3, 0.4, 0, 0.5, -0.4, 0]
const TOM_PAN = [-0.25, 0.1, 0.4]
const LATE = [[1, 1.5], [2, 3], [0, 5], [0, 5], [0.5, 4], [1, 3], [0, 6], [1, 2], [0, 1]]

/** COMBO's drummer: modelled drums (membranes that bend in pitch, snare wires,
 *  cymbal plates, the stick on each) in five kits, the genre's percussion, in
 *  a stereo room, played with a person's looseness: each hit lands a few ms
 *  late by its own feel and a little louder or softer, never twice the same. */
export class DrumKit {
  private kit = KITS.ACOUSTIC
  private perc: PercName = 'TAMB'
  private readonly rng = new Rng(0x5eed)
  private readonly rnd = () => this.rng.next()
  private readonly kick: Drum
  private readonly snare: Drum
  private readonly tomsD: Drum[]
  private readonly percD: Drum
  private readonly sticks: Drum
  private readonly hats: Metal
  private readonly ride: Metal
  private readonly crash: Metal
  private readonly percM: Metal
  private readonly wireHp: Biquad
  private readonly wireLp: Biquad
  private wire = 0
  private wireK = 1
  private wireRise = 0
  private clap = 0
  private clapAge = 0
  private readonly clapK: number
  private readonly clapBp: Biquad
  private readonly room: DrumRoom
  /** Hits waiting to land: samples to go (−1 none), velocity, tom. */
  private readonly wait = new Int32Array(DRUM_SLOTS).fill(-1)
  private readonly waitVel = new Float64Array(DRUM_SLOTS)
  private readonly waitTom = new Int8Array(DRUM_SLOTS)
  private lastTom = 0
  l = 0
  r = 0

  constructor(private readonly fs: number) {
    this.kick = new Drum(fs)
    this.snare = new Drum(fs)
    this.tomsD = [new Drum(fs), new Drum(fs), new Drum(fs)]
    this.percD = new Drum(fs)
    this.sticks = new Drum(fs)
    this.hats = new Metal(fs)
    this.ride = new Metal(fs)
    this.crash = new Metal(fs)
    this.percM = new Metal(fs)
    this.wireHp = new Biquad(fs)
    this.wireLp = new Biquad(fs)
    this.clapBp = new Biquad(fs).bandpass(1200, 1.2)
    this.clapK = Math.exp(-1 / (PERC.CLAP.decay * fs))
    this.room = new DrumRoom(fs)
    this.setGenre('ACOUSTIC', 'TAMB')
  }

  setGenre(kit: KitName, perc: PercName): void {
    this.kit = KITS[kit]
    this.perc = perc
    this.wireHp.highpass(this.kit.wires[2], 0.7)
    this.wireLp.lowpass(this.kit.wires[3], 0.7)
  }

  /** The band asks for a hit; it lands a moment later, as a person's would. */
  hit(slot: number, vel: number, tom: number): void {
    if (this.wait[slot] >= 0) this.land(slot, this.waitVel[slot], this.waitTom[slot])
    const lo = LATE[slot][0]
    const hi = LATE[slot][1]
    this.wait[slot] = Math.round(((lo + (hi - lo) * this.rng.next()) / 1000) * this.fs)
    this.waitVel[slot] = Math.min(1, vel * (0.92 + 0.16 * this.rng.next()))
    this.waitTom[slot] = tom
  }

  private land(slot: number, vel: number, tom: number): void {
    const k = this.kit
    const rnd = this.rnd
    switch (slot) {
      case K:
        this.kick.strike(k.kick, vel, rnd)
        break
      case S:
        this.snare.strike(k.snare, vel * (k.brush ? 0.4 : 1), rnd)
        this.wire = vel * k.wires[0]
        this.wireK = Math.exp(-1 / (k.wires[1] * this.fs))
        this.wireRise = k.brush ? 0 : 1
        break
      case H:
        this.hats.strike(k.hats, vel * 1.3, k.hat[0], rnd)
        break
      case O:
        this.hats.strike(k.hats, vel * 1.3, k.hat[1], rnd)
        break
      case R:
        this.ride.strike(RIDE, vel * 0.9, k.ride, rnd)
        break
      case C:
        this.crash.strike(CRASH, vel * 1.1, k.crash, rnd)
        break
      case T:
        this.lastTom = Math.max(0, Math.min(2, tom))
        this.tomsD[this.lastTom].strike(k.toms[this.lastTom], vel, rnd)
        break
      case P: {
        const p = PERC[this.perc]
        if (p.drum) this.percD.strike(p.drum, vel * 0.8, rnd)
        else if (p.metal) this.percM.strike(p.metal, vel * 0.5, p.decay, rnd)
        else {
          this.clap = vel
          this.clapAge = 0
        }
        break
      }
      case X:
        this.sticks.strike(STICKS, vel * 0.6, rnd)
        break
    }
  }

  /** One sample of the kit, in l / r. */
  step(): void {
    for (let s = 0; s < DRUM_SLOTS; s++)
      if (this.wait[s] >= 0 && this.wait[s]-- === 0) {
        this.wait[s] = -1
        this.land(s, this.waitVel[s], this.waitTom[s])
      }
    const k = this.kit
    const n = this.rng.next() * 2 - 1
    const fs = this.fs
    const kick = this.kick.step(n)
    // the snare: its head, and the wires rattling with it (a brush swishes in)
    const sn = this.snare.step(n)
    let wires = 0
    if (this.wire > 1e-5) {
      if (this.wireRise < 1) this.wireRise += 1 / (0.018 * fs)
      wires = this.wireLp.run(this.wireHp.run(n)) * this.wire * Math.min(1, this.wireRise) * (0.6 + 0.4 * Math.min(1, Math.abs(sn) * 4))
      this.wire *= this.wireK
    }
    const hats = this.hats.step(n)
    const ride = this.ride.step(n)
    const crash = this.crash.step(n)
    let tomL = 0
    let tomR = 0
    for (let t = 0; t < 3; t++) {
      const y = this.tomsD[t].step(n)
      tomL += y * (1 - TOM_PAN[t]) * 0.5
      tomR += y * (1 + TOM_PAN[t]) * 0.5
    }
    // percussion (a clap is a few hands just apart: it stutters at the front)
    let perc = this.percD.step(n) + this.percM.step(n)
    if (this.clap > 1e-5) {
      const a = this.clapAge++
      const stutter = a < fs * 0.03 ? (Math.floor(a / (fs * 0.009)) % 2 === 0 ? 1 : 0.3) : 1
      perc += this.clapBp.run(n) * this.clap * stutter * 1.4
      this.clap *= this.clapK
    }
    const sticks = this.sticks.step(n)
    const sn2 = sn + wires
    // pan each piece, send it all to the room
    const P0 = PAN
    let l = kick + sticks
    let r = l
    l += sn2 * (1 - P0[S]) * 0.5 * 2
    r += sn2 * (1 + P0[S]) * 0.5 * 2
    l += hats * (1 - P0[H]) + ride * (1 - P0[R]) + crash * (1 - P0[C]) + perc * (1 - P0[P]) + tomL * 2
    r += hats * (1 + P0[H]) + ride * (1 + P0[R]) + crash * (1 + P0[C]) + perc * (1 + P0[P]) + tomR * 2
    this.room.step((kick * 0.5 + sn2 + tomL + tomR + (hats + ride + crash) * 0.5 + perc) * k.room, k.size)
    this.l = (l + this.room.l) * 1.2
    this.r = (r + this.room.r) * 1.2
  }
}
