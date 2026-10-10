import { BEES, BUG_VALUES, GARDEN_BUGS, plantDepth, plantHeight } from '../../../../modules/specs/garden'
import type { Rng } from '../../util'
import type { Plant } from './plant'

/** Scene units across the bed (x 0..1) on a typical screen: insects steer in
 *  scene units so they fly at believable speeds. */
const BED_W = 2.8
/** Bees: quick, direct, a high-frequency wobble; a short sip.
 *  Butterflies: slow, bobbing on every wingbeat, meandering; a long sip. */
const BEE = { vmax: 0.7, tau: 0.15, sip: [1.5, 2] }
const FLY = { vmax: 0.32, tau: 0.45, sip: [3, 4] }
/** How long an insect hangs about with nothing in flower before leaving. */
const BORED = 8

class Bug {
  here = false
  x = -1
  y = 0.6
  z = 0
  vx = 0
  vy = 0
  vz = 0
  target = -1
  land = 0
  stay = 0
  /** The flower whose pollen it carries. */
  pollen = -1
  idle = 0
  leaving = false
  phase = 0
  t = 0
}

/** The garden's insects. They come in by day when something is in flower,
 *  fly from open flower to open flower, settle and feed, and leave at dusk.
 *  Pollen from one flower dusted onto another of its kind pollinates it, and
 *  only pollinated flowers seed near themselves: which flowers spread is up
 *  to where the insects went. */
export class Bugs {
  private readonly bugs: Bug[]

  constructor(private readonly rng: Rng) {
    this.bugs = Array.from({ length: GARDEN_BUGS }, () => {
      const b = new Bug()
      b.phase = rng.next() * 100
      return b
    })
  }

  /** Nobody here yet. */
  reset(): void {
    for (let k = 0; k < this.bugs.length; k++) {
      const b = this.bugs[k]
      b.here = b.leaving = false
      b.x = b.target = b.pollen = -1
      b.y = 0.6
      b.z = b.vx = b.vy = b.vz = b.land = b.stay = b.idle = b.t = 0
    }
  }

  /** Returns how many flowers were pollinated this tick. */
  step(dt: number, light: number, plants: Plant[], wind: number, bees: number, flies: number, flick: number, lure = false, lx = 0.5, ly = 0.5): number {
    let pollinated = 0
    let anyOpen = lure // a lure brings them in even with nothing in flower
    for (let i = 0; i < plants.length; i++) if (plants[i].inviting) anyOpen = true
    for (let k = 0; k < this.bugs.length; k++) {
      const b = this.bugs[k]
      const fly = k >= BEES
      const kind = fly ? FLY : BEE
      const active = (fly ? k - BEES < flies : k < bees) && light > 0.3
      b.t += dt
      if (!b.here) {
        // arrive now and then, from one side, while there's something to visit
        if (active && anyOpen && this.rng.next() < dt * 0.25) this.enter(b)
        continue
      }
      if (!active) b.leaving = true
      const target = b.target >= 0 ? plants[b.target] : null
      if (target && !target.inviting) this.depart(b, plants) // it closed or wilted under them
      if (flick > 0.5 && b.land > 0) {
        this.depart(b, plants) // TRIG or a tap shakes them off
        b.vy = 0.5
      }
      if (lure && b.land > 0) this.depart(b, plants) // called away from its flower
      else if (lure) b.target = -1
      if (b.target < 0 && !b.leaving && !lure) {
        b.target = this.choose(k, plants, b.pollen)
        if (b.target < 0 && (b.idle += dt) > BORED) b.leaving = true
      }
      // where it's heading: a flower's head, a hover spot, the lure, or off the screen
      let tx: number
      let ty: number
      let tz: number
      if (lure && !b.leaving) {
        // a loose cloud round the point, each in its own orbit
        tx = lx + Math.sin(b.t * 0.9 + b.phase) * 0.06
        ty = 0.05 + ly * 1.1 + Math.cos(b.t * 1.3 + b.phase) * 0.06
        tz = 0.1 + Math.sin(b.t * 0.7 + b.phase * 2) * 0.15
      } else if (b.leaving) {
        tx = b.x < 0.5 ? -0.2 : 1.2
        ty = 0.9
        tz = b.z
      } else if (b.target >= 0) {
        const p = plants[b.target]
        tx = p.x
        ty = plantHeight(p.size, p.species, p.g) + 0.035
        tz = plantDepth(p.x)
      } else {
        tx = 0.5 + Math.sin(b.t * 0.3 + b.phase) * 0.35
        ty = 0.7
        tz = 0.1
      }
      const dx = (tx - b.x) * BED_W
      const dy = ty - b.y
      const dz = tz - b.z
      const dist = Math.hypot(dx, dy, dz)
      if (b.target >= 0 && !b.leaving && (b.land > 0 || dist < 0.035)) {
        // settled on the flower, feeding
        if (b.land === 0) b.stay = kind.sip[0] + this.rng.next() * kind.sip[1]
        b.land = Math.min(1, b.land + dt / 0.25)
        b.x = tx
        b.y = ty
        b.z = tz
        b.vx = b.vy = b.vz = 0
        if ((b.stay -= dt) <= 0) pollinated += this.depart(b, plants)
        continue
      }
      // flying: steer toward the goal at up to vmax, plus each insect's way of flying
      const sp = Math.min(kind.vmax, dist * 2.5) / Math.max(1e-4, dist)
      let wx = dx * sp
      let wy = dy * sp
      let wz = dz * sp
      if (fly) {
        const turn = Math.sin(b.t * 0.7 + b.phase) * 0.9 // meander
        const c = Math.cos(turn)
        const s = Math.sin(turn)
        const rx = wx * c - wz * s
        wz = wx * s + wz * c
        wx = rx + wind * 0.12
        wy += Math.sin(b.t * 9 + b.phase) * 0.35 // bobbing on the wingbeats
      } else {
        wx += Math.sin(b.t * 17 + b.phase) * 0.12
        wy += Math.sin(b.t * 13 + b.phase * 2) * 0.07
        wz += Math.cos(b.t * 11 + b.phase) * 0.1
      }
      const e = 1 - Math.exp(-dt / kind.tau)
      b.vx += (wx - b.vx) * e
      b.vy += (wy - b.vy) * e
      b.vz += (wz - b.vz) * e
      b.x += (b.vx / BED_W) * dt
      b.y = Math.max(0.06, b.y + b.vy * dt)
      b.z += b.vz * dt
      if (b.leaving && (b.x < -0.15 || b.x > 1.15)) {
        b.here = false
        b.x = -1
      }
    }
    return pollinated
  }

  private enter(b: Bug): void {
    b.here = true
    b.leaving = false
    b.x = this.rng.next() < 0.5 ? -0.1 : 1.1
    b.y = 0.5 + this.rng.next() * 0.6
    b.z = -0.3 + this.rng.next() * 0.9
    b.vx = b.vy = b.vz = 0
    b.target = -1
    b.land = 0
    b.idle = 0
    b.pollen = -1
  }

  /** Leave the flower it's on (or heading for); dusting it with pollen from
   *  the last one first. Returns 1 if that pollinated it. */
  private depart(b: Bug, plants: Plant[]): number {
    let done = 0
    if (b.land > 0 && b.target >= 0) {
      const p = plants[b.target]
      if (b.pollen >= 0 && b.pollen !== b.target && plants[b.pollen].species === p.species && !p.pollinated) {
        p.pollinated = true
        done = 1
      }
      b.pollen = b.target
      b.vy = 0.25
    }
    b.target = -1
    b.land = 0
    b.idle = 0
    return done
  }

  /** An open flower to visit: not the one it just fed on, not one another
   *  insect is already heading for. */
  private choose(k: number, plants: Plant[], last: number): number {
    let pick = -1
    let seen = 0
    for (let i = 0; i < plants.length; i++) {
      if (i === last || !plants[i].inviting) continue
      let taken = false
      for (let j = 0; j < this.bugs.length; j++) if (j !== k && this.bugs[j].here && this.bugs[j].target === i) taken = true
      if (taken) continue
      if (this.rng.next() * ++seen < 1) pick = i // pick one at random, in one pass
    }
    return pick
  }

  publish(led: Float32Array, base: number): void {
    for (let k = 0; k < this.bugs.length; k++) {
      const b = this.bugs[k]
      const o = base + k * BUG_VALUES
      led[o] = b.here ? b.x : -1
      led[o + 1] = b.y
      led[o + 2] = b.z
      led[o + 3] = b.land > 0 && b.target >= 0 ? b.target + Math.min(0.999, b.land) : -1
    }
  }
}
