import { ZN_FACTORY } from '../../../modules/specs/zones'
import { Rng, TAU } from '../util'
import type { SampleData } from './voice'

/** A multisample laid out as a grid of takes, all the same length, one after
 *  another in one buffer: for each velocity layer (soft first), for each
 *  round robin, a take at each root from `lo` up in steps of `every`. */
export interface ZoneMap {
  lo: number
  every: number
  roots: number
  layers: number
  rr: number
  /** Samples per take. */
  slot: number
}

export interface MultiSample extends SampleData {
  map: ZoneMap
}

/** Where take (layer, round robin, root index) starts in the buffer. */
export const takeAt = (m: ZoneMap, layer: number, k: number, r: number): number => ((layer * m.rr + k) * m.roots + r) * m.slot

/** The root index nearest a note. */
export const rootFor = (m: ZoneMap, note: number): number => Math.max(0, Math.min(m.roots - 1, Math.round((note - m.lo) / m.every)))

/** The velocity layer for a velocity (0..1). */
export const layerFor = (m: ZoneMap, vel: number): number => Math.max(0, Math.min(m.layers - 1, Math.floor(vel * m.layers)))

const TINE_RATE = 22050
const TINE_S = 1.8
const LAYER_VEL = [0.42, 1]
let tines: MultiSample | null = null

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** One tine piano note into d at `at`: a struck tine (a sine whose pickup bark,
 *  an FM-like brightness, grows with how hard it's hit and dies away), the
 *  metallic ping of the strike, the hammer's thump; low notes ring longer.
 *  Each round robin is struck a little differently. */
function tine(d: Float32Array, at: number, len: number, note: number, vel: number, rng: Rng): void {
  const f = hz(note) * (1 + (rng.next() - 0.5) * 0.0012)
  const tau = Math.max(0.5, Math.min(4, 3.2 * Math.pow(2, -(note - 48) / 26)))
  const decay = Math.exp(-1 / (tau * TINE_RATE))
  const barkDecay = Math.exp(-1 / ((0.18 + 0.1 * vel) * TINE_RATE))
  const pingDecay = Math.exp(-1 / (0.025 * TINE_RATE))
  const thumpDecay = Math.exp(-1 / (0.006 * TINE_RATE))
  const pf = Math.min(f * 7.13, TINE_RATE * 0.45)
  const w = (TAU * f) / TINE_RATE
  const wp = (TAU * pf) / TINE_RATE
  let env = 1
  let bark = vel * vel * (2.4 + rng.next() * 0.3) + 0.15
  let ping = 0.22 * vel * (0.8 + rng.next() * 0.4)
  let thump = 0.12 * vel
  let ph = rng.next() * 0.2
  let pp = rng.next() * TAU
  let lp = 0
  // the pickup's even harmonics leave a drifting offset: a DC blocker takes it out
  let x1 = 0
  let y1 = 0
  const fadeAt = len - Math.round(0.3 * TINE_RATE)
  for (let i = 0; i < len; i++) {
    ph += w
    pp += wp
    let y = Math.sin(ph + bark * Math.sin(ph))
    y = (y + 0.12 * vel * y * y) * env * (0.45 + 0.55 * vel)
    y1 = y - x1 + 0.996 * y1
    x1 = y
    lp += (rng.next() * 2 - 1 - lp) * 0.08
    const tail = i > fadeAt ? 1 - (i - fadeAt) / (len - fadeAt) : 1
    d[at + i] = (y1 + Math.sin(pp) * ping + lp * thump * 4) * tail
    env *= decay
    bark = 0.15 + (bark - 0.15) * barkDecay
    ping *= pingDecay
    thump *= thumpDecay
  }
}

/** The factory multisample, TINE PIANO, made once (and shared by every ZONES). */
export function tinePiano(): MultiSample {
  if (tines) return tines
  const slot = Math.round(TINE_S * TINE_RATE)
  const map: ZoneMap = { ...ZN_FACTORY, slot }
  const data = new Float32Array(map.layers * map.rr * map.roots * slot)
  const rng = new Rng(0x7135)
  for (let l = 0; l < map.layers; l++)
    for (let k = 0; k < map.rr; k++)
      for (let r = 0; r < map.roots; r++) tine(data, takeAt(map, l, k, r), slot, map.lo + r * map.every, LAYER_VEL[l], rng)
  let pk = 0
  for (let i = 0; i < data.length; i++) pk = Math.max(pk, Math.abs(data[i]))
  for (let i = 0; i < data.length; i++) data[i] *= 0.9 / pk
  tines = { data, len: data.length, rate: TINE_RATE, map }
  return tines
}
