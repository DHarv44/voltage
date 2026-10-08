import { SPECS } from '../modules'
import { defaultParams } from '../modules/params'
import { RAIL_SIZES, ROW_HP, usedHp } from './layout'
import type { Cable, ModuleInst, MorphSnapshot, Patch } from './types'

const KEY = 'voltage.patch.v1'
let timer: number | undefined

/** `?scratch` in the URL: a throwaway rack that never reads or writes the saved patch. */
export const SCRATCH = new URLSearchParams(location.search).has('scratch')

/** When the first unsaved change happened (a steady stream of changes, like a
 *  knob playing back, must not hold the save off forever). */
let pendingSince = 0
const SAVE_DEBOUNCE_MS = 300
const SAVE_MAX_WAIT_MS = 2000

export function save(p: Patch): void {
  if (SCRATCH) return
  window.clearTimeout(timer)
  const now = Date.now()
  if (!pendingSince) pendingSince = now
  const wait = Math.max(0, Math.min(SAVE_DEBOUNCE_MS, pendingSince + SAVE_MAX_WAIT_MS - now))
  timer = window.setTimeout(() => {
    pendingSince = 0
    try {
      localStorage.setItem(KEY, JSON.stringify(p))
    } catch {
      /* storage unavailable: patch just isn't remembered */
    }
  }, wait)
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

/** Stored knob snapshots (XY corners, scenes, macro ranges): up to 16. */
function sanitizeMorph(raw: unknown[]): (MorphSnapshot | null)[] {
  return raw.slice(0, 16).map((s) => {
    if (!s || typeof s !== 'object') return null
    const out: MorphSnapshot = {}
    for (const [k, v] of Object.entries(s)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    return out
  })
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** Accepts anything (saved or imported JSON) and returns a valid patch or null. */
export function sanitize(raw: unknown): Patch | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { rows?: unknown; modules?: unknown; cables?: unknown; rail?: unknown }
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
      ...(typeof m.width === 'number' && SPECS[m.type].sizes?.includes(m.width) ? { width: m.width } : {}),
      params: { ...defaultParams(SPECS[m.type]), ...(typeof m.params === 'object' ? m.params : {}) },
      ...(Array.isArray(m.morph) ? { morph: sanitizeMorph(m.morph) } : {}),
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
  // the rail must hold every module; otherwise the narrowest standard one that does
  const need = usedHp({ rows, modules, cables })
  const asked = typeof r.rail === 'number' && RAIL_SIZES.includes(r.rail) ? r.rail : ROW_HP
  const rail = asked >= need ? asked : (RAIL_SIZES.find((s) => s >= need) ?? RAIL_SIZES[RAIL_SIZES.length - 1])
  return { rows, ...(rail !== ROW_HP ? { rail } : {}), modules, cables }
}
