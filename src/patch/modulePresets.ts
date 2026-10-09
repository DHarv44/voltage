import { useSyncExternalStore } from 'react'
import { SPECS } from '../modules'

/** A module's settings saved under a name: every knob, switch and stored
 *  pattern, to load onto any module of the same type (in any rack). */
export interface ModulePreset {
  name: string
  params: Record<string, number>
}

type Store = Record<string, ModulePreset[]>

const KEY = 'voltage.modulePresets.v1'
/** One shared empty list, so a type with no presets reads the same each time. */
const NONE: ModulePreset[] = []

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as unknown) : {}
    return v && typeof v === 'object' ? (v as Store) : {}
  } catch {
    return {}
  }
}

let state = load()
const subs = new Set<() => void>()

function commit(next: Store): void {
  state = next
  subs.forEach((f) => f())
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* not persisted (private window, storage full) */
  }
}

/** Only the params the module type has, as numbers (a preset from an older
 *  version, or hand-edited storage, can't put rubbish into a module). */
function clean(type: string, params: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const ps of SPECS[type]?.params ?? []) {
    const v = params[ps.id]
    if (typeof v === 'number' && Number.isFinite(v)) out[ps.id] = Math.max(ps.min, Math.min(ps.max, v))
  }
  return out
}

export const modulePresets = {
  get: () => state,
  subscribe(fn: () => void) {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },
  of: (type: string): ModulePreset[] => state[type] ?? NONE,
  /** Save (a name already used is replaced). */
  save(type: string, name: string, params: Record<string, number>): void {
    const n = name.trim().slice(0, 40)
    if (!n) return
    const list = (state[type] ?? []).filter((p) => p.name !== n)
    commit({ ...state, [type]: [...list, { name: n, params: clean(type, params) }].sort((a, b) => a.name.localeCompare(b.name)) })
  },
  remove(type: string, name: string): void {
    commit({ ...state, [type]: (state[type] ?? []).filter((p) => p.name !== name) })
  },
  /** The params to set on a module to load this preset. */
  values: (type: string, p: ModulePreset) => clean(type, p.params),
}

export function useModulePresets(type: string): ModulePreset[] {
  return useSyncExternalStore(modulePresets.subscribe, () => modulePresets.of(type))
}
