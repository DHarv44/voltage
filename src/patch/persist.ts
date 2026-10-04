import { SPECS } from '../modules'
import { defaultParams } from '../modules/params'
import type { Cable, ModuleInst, Patch } from './types'

const KEY = 'voltage.patch.v1'
let timer: number | undefined

/** `?scratch` in the URL: a throwaway rack that never reads or writes the saved patch. */
export const SCRATCH = new URLSearchParams(location.search).has('scratch')

export function save(p: Patch): void {
  if (SCRATCH) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p))
    } catch {
      /* storage unavailable: patch just isn't remembered */
    }
  }, 300)
}

export function loadSaved(): Patch | null {
  if (SCRATCH) return { rows: 2, modules: [], cables: [] }
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? sanitize(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** Accepts anything (saved or imported JSON) and returns a valid patch or null. */
export function sanitize(raw: unknown): Patch | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { rows?: unknown; modules?: unknown; cables?: unknown }
  if (!Array.isArray(r.modules) || !Array.isArray(r.cables)) return null

  const modules: ModuleInst[] = []
  for (const m of r.modules as Partial<ModuleInst>[]) {
    if (!m || typeof m.id !== 'string' || typeof m.type !== 'string' || !SPECS[m.type]) continue
    modules.push({
      id: m.id,
      type: m.type,
      row: Math.max(0, Math.round(num(m.row))),
      hp: Math.max(0, Math.round(num(m.hp))),
      seed: num(m.seed, 1),
      params: { ...defaultParams(SPECS[m.type]), ...(typeof m.params === 'object' ? m.params : {}) },
    })
  }
  const byId = new Map(modules.map((m) => [m.id, m]))
  const cables = (r.cables as Partial<Cable>[]).filter((c): c is Cable => {
    const a = c?.from && byId.get(c.from.mod)
    const b = c?.to && byId.get(c.to.mod)
    return (
      !!a &&
      !!b &&
      typeof c.id === 'string' &&
      SPECS[a.type].outputs.some((j) => j.id === c.from!.jack) &&
      SPECS[b.type].inputs.some((j) => j.id === c.to!.jack)
    )
  })
  const rows = Math.max(1, Math.round(num(r.rows, 1)), ...modules.map((m) => m.row + 1))
  return { rows, modules, cables }
}
