import { SPECS } from '../../modules'
import { fromNorm, toNorm } from '../../modules/params'
import type { ParamSpec } from '../../modules/types'
import type { MorphSnapshot, Patch } from '../../patch/types'

/** Modules that move other modules' knobs: never captured (no feedback loops). */
export const CONTROLLERS = new Set(['xy', 'scenes', 'macro', 'accident'])

/** Every continuous knob in the rack except the controller modules (switches
 *  and step patterns are left alone: morphing them would just flip-flop). */
export function captureSnapshot(p: Patch): MorphSnapshot {
  const snap: MorphSnapshot = {}
  for (const m of p.modules) {
    if (CONTROLLERS.has(m.type)) continue
    for (const ps of SPECS[m.type].params) if (!ps.stepped) snap[`${m.id}/${ps.id}`] = m.params[ps.id]
  }
  return snap
}

/** Look up a "moduleId/param" key's spec and current module. */
export function keyInfo(p: Patch, key: string) {
  const slash = key.lastIndexOf('/')
  const id = key.slice(0, slash)
  const param = key.slice(slash + 1)
  const m = p.modules.find((x) => x.id === id)
  const ps = m ? SPECS[m.type].params.find((q) => q.id === param) : undefined
  return m && ps ? { id, param, ps, m } : null
}

/** Interpolate between two snapshots in knob-travel space (t = 0 → a, 1 → b);
 *  keys only in one of them are left alone. */
export function lerpSnapshots(p: Patch, a: MorphSnapshot, b: MorphSnapshot, t: number): [string, string, number][] {
  const out: [string, string, number][] = []
  for (const key of Object.keys(b)) {
    if (a[key] === undefined) continue
    const info = keyInfo(p, key)
    if (!info) continue
    const v = fromNorm(info.ps, toNorm(info.ps, a[key]) + (toNorm(info.ps, b[key]) - toNorm(info.ps, a[key])) * t)
    if (Math.abs(v - info.m.params[info.param]) > 1e-9) out.push([info.id, info.param, v])
  }
  return out
}

/** Bilinear corner weights: A top-left, B top-right, C bottom-left, D bottom-right. */
function weights(x: number, y: number): number[] {
  // a hair of every corner, so a dot sitting on an empty corner still blends
  return [(1 - x) * y, x * y, (1 - x) * (1 - y), x * (1 - y)].map((v) => v + 1e-3)
}

/** Blend the stored corners at dot (x, y). Only knobs that differ between the
 *  stored corners move; blending happens in knob-travel space so exponential
 *  knobs (cutoff, time) sweep the way your hand would turn them. */
export function blend(p: Patch, corners: (MorphSnapshot | null)[], x: number, y: number): [string, string, number][] {
  const w = weights(x, y)
  const used = corners.map((c, i) => (c ? i : -1)).filter((i) => i >= 0)
  if (used.length < 2) return []
  const keys = new Set<string>()
  for (const i of used) for (const k of Object.keys(corners[i]!)) keys.add(k)
  const byId = new Map(p.modules.map((m) => [m.id, m]))
  const out: [string, string, number][] = []
  for (const key of keys) {
    const slash = key.lastIndexOf('/')
    const id = key.slice(0, slash)
    const param = key.slice(slash + 1)
    const m = byId.get(id)
    const ps: ParamSpec | undefined = m && SPECS[m.type].params.find((q) => q.id === param)
    if (!m || !ps) continue
    let lo = Infinity
    let hi = -Infinity
    let sum = 0
    let wsum = 0
    for (const i of used) {
      const v = corners[i]![key]
      if (v === undefined) continue
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
      sum += toNorm(ps, v) * w[i]
      wsum += w[i]
    }
    if (hi - lo < 1e-9 || wsum <= 1e-6) continue
    const v = fromNorm(ps, sum / wsum)
    if (Math.abs(v - m.params[param]) > 1e-6 * Math.max(1, Math.abs(v))) out.push([id, param, v])
  }
  return out
}
