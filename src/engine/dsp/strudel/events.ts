import { laneKey, type LanePlan } from '../../../strudel/lanes'
import { drumOf, isNoise } from '../../../strudel/music'
import { hasOnset } from '../../../strudel/pattern'

const CAP = 4096

/** One cycle's events, flattened into typed arrays sorted by time (filled
 *  once per cycle, walked by tick without allocating). */
export class CycleEvents {
  readonly t = new Float64Array(CAP)
  readonly dur = new Float64Array(CAP)
  readonly lane = new Int8Array(CAP)
  readonly drum = new Int8Array(CAP)
  readonly note = new Float32Array(CAP)
  readonly vel = new Float32Array(CAP)
  /** log2(cutoff / 20) volts from lpf / hpf, or −1 for none. */
  readonly mod = new Float32Array(CAP)
  n = 0
  dropped = 0
  private readonly order: number[] = []

  /** Query the plan's patterns over cycle c; a sound-keyed plan puts each event on its sound's lane. */
  fill(plan: LanePlan, c: number): void {
    this.n = 0
    this.dropped = 0
    const pats = plan.pats
    for (let pi = 0; pi < pats.length; pi++) {
      let haps
      try {
        haps = pats[pi].query(c, c + 1)
      } catch {
        continue
      }
      for (const h of haps) {
        if (!hasOnset(h)) continue
        const v = h.v
        const s = v.s === undefined ? '' : String(v.s)
        const drum = s ? drumOf(s) : -1
        let note = NaN
        if (drum < 0) {
          if (v.note !== undefined) note = Number(v.note)
          else if (v.freq !== undefined) note = 69 + 12 * Math.log2(Number(v.freq) / 440)
          else if (v.n !== undefined) note = 48 + Number(v.n)
          else if (isNoise(s)) note = 60
          if (!Number.isFinite(note)) continue
        }
        const l = drum >= 0 ? 0 : plan.byName ? (plan.byName.get(laneKey(v)) ?? plan.rest) : pi
        const t = h.b - c
        // the same note at the same moment on one lane (a layered sound): one event
        let dup = -1
        for (let k = this.n - 1; k >= 0 && this.t[k] > t - 1e-4; k--) {
          if (this.lane[k] === l && this.drum[k] === drum && (drum >= 0 || Math.abs(this.note[k] - note) < 0.01) && Math.abs(this.t[k] - t) < 1e-4) {
            dup = k
            break
          }
        }
        const gain = v.gain === undefined ? 1 : Number(v.gain)
        const vel = Math.max(0, Math.min(1, gain * (v.velocity === undefined ? 1 : Number(v.velocity))))
        if (dup >= 0) {
          this.vel[dup] = Math.max(this.vel[dup], vel)
          continue
        }
        if (this.n >= CAP) {
          this.dropped++
          continue
        }
        const i = this.n++
        this.t[i] = t
        this.dur[i] = Math.max(0.001, (h.e - h.b) * (v.legato === undefined ? 1 : Number(v.legato)))
        this.lane[i] = l
        this.drum[i] = drum
        this.note[i] = note
        this.vel[i] = vel
        const cut = v.hpf !== undefined ? Number(v.hpf) : v.lpf !== undefined ? Number(v.lpf) : NaN
        this.mod[i] = Number.isFinite(cut) && cut > 0 ? Math.max(0, Math.min(10, Math.log2(cut / 20))) : -1
      }
    }
    this.sort()
  }

  /** Events come out lane by lane: put them in time order (a stable sort of indices). */
  private sort(): void {
    const n = this.n
    const o = this.order
    o.length = n
    for (let i = 0; i < n; i++) o[i] = i
    o.sort((a, b) => this.t[a] - this.t[b] || a - b)
    let sorted = true
    for (let i = 0; i < n; i++) if (o[i] !== i) sorted = false
    if (sorted) return
    const pick = <T extends Float64Array | Float32Array | Int8Array>(arr: T) => {
      const copy = arr.slice(0, n)
      for (let i = 0; i < n; i++) arr[i] = copy[o[i]]
    }
    pick(this.t)
    pick(this.dur)
    pick(this.lane)
    pick(this.drum)
    pick(this.note)
    pick(this.vel)
    pick(this.mod)
  }
}
