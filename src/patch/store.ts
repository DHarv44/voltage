import { SPECS } from '../modules'
import { defaultParams } from '../modules/params'
import { defaultPatch } from './defaultPatch'
import { makeModule, uid } from './factory'
import { findSlot, placeWithPush } from './layout'
import { loadSaved, sanitize, save } from './persist'
import type { JackRef, Patch } from './types'

type Listener = () => void

let state: Patch = loadSaved() ?? defaultPatch()
save(state) // persist a fresh rack immediately so module seeds (unit personalities) survive reloads
const listeners = new Set<Listener>()

function set(next: Patch): void {
  state = next
  listeners.forEach((l) => l())
  save(next)
}

export const patchStore = {
  get: (): Patch => state,
  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

export type JackEnd = JackRef & { dir: 'in' | 'out' }

export const actions = {
  addModule(type: string, params?: Record<string, number>): string | null {
    const spec = SPECS[type]
    if (!spec) return null
    let p = state
    let slot = findSlot(p, spec.hp)
    if (!slot) {
      p = { ...p, rows: p.rows + 1 }
      slot = { row: p.rows - 1, hp: 0 }
    }
    const m = makeModule(type, slot.row, slot.hp)
    if (params) Object.assign(m.params, params)
    set({ ...p, modules: [...p.modules, m] })
    return m.id
  },

  /** Move a module to (row, hp), sliding neighbours aside. row === rows adds a row. */
  placeModule(id: string, row: number, hp: number): boolean {
    const m = state.modules.find((x) => x.id === id)
    if (!m || row < 0 || row > state.rows) return false
    const pl = placeWithPush(state, row, hp, SPECS[m.type].hp, id)
    if (!pl) return false
    set({
      ...state,
      rows: Math.max(state.rows, row + 1),
      modules: state.modules.map((x) =>
        x.id === id ? { ...x, row, hp: pl.hp } : x.row === row && x.id in pl.moves ? { ...x, hp: pl.moves[x.id] } : x,
      ),
    })
    return true
  },

  /** Insert a new module at (row, hp), sliding neighbours aside. row === rows adds a row. */
  insertModule(type: string, row: number, hp: number): string | null {
    const spec = SPECS[type]
    if (!spec || row < 0 || row > state.rows) return null
    const pl = placeWithPush(state, row, hp, spec.hp)
    if (!pl) return null
    const m = makeModule(type, row, pl.hp)
    set({
      ...state,
      rows: Math.max(state.rows, row + 1),
      modules: [...state.modules.map((x) => (x.row === row && x.id in pl.moves ? { ...x, hp: pl.moves[x.id] } : x)), m],
    })
    return m.id
  },

  removeModule(id: string): void {
    set({
      ...state,
      modules: state.modules.filter((m) => m.id !== id),
      cables: state.cables.filter((c) => c.from.mod !== id && c.to.mod !== id),
    })
  },

  setParam(id: string, param: string, value: number): void {
    set({
      ...state,
      modules: state.modules.map((m) => (m.id === id ? { ...m, params: { ...m.params, [param]: value } } : m)),
    })
  },

  resetParams(id: string): void {
    set({
      ...state,
      modules: state.modules.map((m) => (m.id === id ? { ...m, params: defaultParams(SPECS[m.type]) } : m)),
    })
  },

  /** Patch two jacks. One must be an output, one an input; an input takes one plug,
   *  so an existing cable in it is pulled first. Outputs fan out freely (stackables). */
  connect(a: JackEnd, b: JackEnd, color: string): void {
    if (a.dir === b.dir) return
    const from = a.dir === 'out' ? a : b
    const to = a.dir === 'in' ? a : b
    const cables = state.cables.filter((c) => !(c.to.mod === to.mod && c.to.jack === to.jack))
    cables.push({ id: uid('c'), from: { mod: from.mod, jack: from.jack }, to: { mod: to.mod, jack: to.jack }, color })
    set({ ...state, cables })
  },

  removeCable(id: string): void {
    set({ ...state, cables: state.cables.filter((c) => c.id !== id) })
  },

  removeCablesAt(mod: string, jack: string): void {
    const at = (r: JackRef) => r.mod === mod && r.jack === jack
    set({ ...state, cables: state.cables.filter((c) => !at(c.from) && !at(c.to)) })
  },

  addRow(): void {
    set({ ...state, rows: state.rows + 1 })
  },

  /** Drop the last row if nothing is mounted in it. */
  removeRow(): void {
    const last = state.rows - 1
    if (last < 1 || state.modules.some((m) => m.row === last)) return
    set({ ...state, rows: last })
  },

  /** Replace the rack. Input is validated; anything invalid is ignored. */
  load(raw: unknown): boolean {
    const p = sanitize(raw)
    if (p) set(p)
    return !!p
  },

  clear(): void {
    set({ rows: 2, modules: [], cables: [] })
  },
}
