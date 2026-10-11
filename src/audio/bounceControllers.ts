import { SPECS } from '../modules'
import { fromNorm, toNorm } from '../modules/params'
import { LANE, MOTION_LANES, MOTL } from '../modules/specs/motion'
import { MACROS, SCENE_SLOTS, SCENEL } from '../modules/specs/perform'
import type { Graph } from '../engine/graph'
import type { MorphSnapshot, Patch } from '../patch/types'

/** In a bounce there's no page to turn knobs, so the worker does what the
 *  page does for the modules that move other modules' knobs: MOTION plays its
 *  lanes into the knobs they learned, MACRO sweeps its learned ranges by knob
 *  + CV, SCENES glides to the scene its CV asks for. Every knob it moves is set
 *  straight in the worker's engine (and remembered here). */
export class BounceControllers {
  /** Each knob's value now ("moduleId/param"), and where it lives. */
  private readonly now = new Map<string, number>()
  private readonly where = new Map<string, { id: string; index: number; norm: (v: number) => number; denorm: (v: number) => number }>()
  private readonly macroApplied = new Map<string, number>()
  private readonly sceneSeen = new Map<string, number>()
  private readonly glides: { from: MorphSnapshot; to: MorphSnapshot; t: number; secs: number }[] = []

  constructor(
    private readonly patch: Patch,
    private readonly g: Graph,
    private readonly rate: number,
  ) {
    for (const m of patch.modules)
      SPECS[m.type].params.forEach((ps, index) => {
        if (ps.stepped) return
        const key = `${m.id}/${ps.id}`
        this.now.set(key, m.params[ps.id])
        this.where.set(key, { id: m.id, index, norm: (v) => toNorm(ps, v), denorm: (n) => fromNorm(ps, n) })
      })
  }

  private set(key: string, v: number): void {
    const w = this.where.get(key)
    if (!w) return
    this.now.set(key, v)
    this.g.setParam(w.id, w.index, v)
  }

  /** Between two snapshots at t, in knob travel (as the page does). */
  private lerp(a: MorphSnapshot, b: MorphSnapshot, t: number): void {
    for (const key of Object.keys(b)) {
      const w = this.where.get(key)
      if (a[key] === undefined || !w) continue
      this.set(key, w.denorm(w.norm(a[key]) + (w.norm(b[key]) - w.norm(a[key])) * t))
    }
  }

  /** Call after each block of `n` samples. */
  step(n: number): void {
    const cables = this.patch.cables
    for (const m of this.patch.modules) {
      const led = this.g.getModule(m.id)?.led
      if (!led) continue
      if (m.type === 'motion') {
        for (let l = 0; l < MOTION_LANES; l++) {
          const key = m.morph?.[l] ? Object.keys(m.morph[l]!)[0] : undefined
          const w = key ? this.where.get(key) : undefined
          if (key && w && led[MOTL.state + l] === LANE.playing) this.set(key, w.denorm(led[MOTL.value + l]))
        }
      } else if (m.type === 'macro') {
        for (let i = 0; i < MACROS; i++) {
          const from = m.morph?.[i * 2]
          const to = m.morph?.[i * 2 + 1]
          if (!from || !to) continue
          const cv = cables.some((c) => c.to.mod === m.id && c.to.jack === `cv${i + 1}`) ? led[i] : 0
          const v = Math.min(1, Math.max(0, m.params[`m${i + 1}`] + cv))
          const k = `${m.id}/${i}`
          if (Math.abs(v - (this.macroApplied.get(k) ?? -1)) < 0.002) continue
          this.macroApplied.set(k, v)
          this.lerp(from, to, v)
        }
      } else if (m.type === 'scenes') {
        const count = led[SCENEL.count]
        const seen = this.sceneSeen.get(m.id)
        this.sceneSeen.set(m.id, count)
        if (seen === undefined || count === seen) continue
        let want = led[SCENEL.want]
        if (want === -2) want = (m.morph ?? []).findIndex((s, k) => !!s && k < SCENE_SLOTS)
        const snap = want >= 0 ? m.morph?.[want] : null
        if (!snap) continue
        const from: MorphSnapshot = {}
        for (const key of Object.keys(snap)) if (this.now.has(key)) from[key] = this.now.get(key)!
        this.glides.push({ from, to: snap, t: 0, secs: m.params.time ?? 1.5 })
      }
    }
    // scene glides in progress (eased, as the page's)
    for (let i = this.glides.length - 1; i >= 0; i--) {
      const gl = this.glides[i]
      gl.t = gl.secs <= 0 ? 1 : Math.min(1, gl.t + n / this.rate / gl.secs)
      this.lerp(gl.from, gl.to, gl.t * gl.t * (3 - 2 * gl.t))
      if (gl.t >= 1) this.glides.splice(i, 1)
    }
  }
}
