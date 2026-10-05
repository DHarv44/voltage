import { SPECS } from '../modules'
import { defaultParams } from '../modules/params'
import { hpOf } from '../modules/size'
import { defaultPatch } from './defaultPatch'
import { makeModule, uid } from './factory'
import { findSlot, placeWithPush } from './layout'
import { loadSaved, sanitize, save } from './persist'
import type { Cable, JackRef, MorphSnapshot, Patch } from './types'

type Listener = () => void

let state: Patch = loadSaved() ?? defaultPatch()
save(state) // persist a fresh rack immediately so module seeds (unit personalities) survive reloads
const listeners = new Set<Listener>()

const HISTORY_LIMIT = 100
const MERGE_MS = 800
const past: Patch[] = []
const future: Patch[] = []
let mergeKey = ''
let mergeAt = 0

function emit(next: Patch): void {
  state = next
  listeners.forEach((l) => l())
  save(next)
}

/** Commit an edit. Edits sharing `key` within MERGE_MS of each other (a knob
 *  being turned, a burst of live-recorded steps) collapse into one undo step. */
function set(next: Patch, key = ''): void {
  const now = Date.now()
  if (!(key && key === mergeKey && now - mergeAt < MERGE_MS)) {
    past.push(state)
    if (past.length > HISTORY_LIMIT) past.shift()
  }
  mergeKey = key
  mergeAt = now
  future.length = 0
  emit(next)
}

export const history = {
  canUndo: (): boolean => past.length > 0,
  canRedo: (): boolean => future.length > 0,
  undo(): void {
    const p = past.pop()
    if (!p) return
    future.push(state)
    mergeKey = ''
    emit(p)
  },
  redo(): void {
    const f = future.pop()
    if (!f) return
    past.push(state)
    mergeKey = ''
    emit(f)
  },
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
    const pl = placeWithPush(state, row, hp, hpOf(m), id)
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

  /** Resize a resizable panel (spec.sizes), sliding neighbours aside to make
   *  room. Fails (false) if the row can't fit it. */
  setWidth(id: string, width: number): boolean {
    const m = state.modules.find((x) => x.id === id)
    if (!m || !SPECS[m.type]?.sizes?.includes(width)) return false
    const pl = placeWithPush(state, m.row, m.hp, width, id)
    if (!pl) return false
    set({
      ...state,
      modules: state.modules.map((x) =>
        x.id === id ? { ...x, hp: pl.hp, width } : x.row === m.row && x.id in pl.moves ? { ...x, hp: pl.moves[x.id] } : x,
      ),
    })
    return true
  },

  removeModule(id: string): void {
    set({
      ...state,
      modules: state.modules.filter((m) => m.id !== id),
      cables: state.cables.filter((c) => c.from.mod !== id && c.to.mod !== id),
    })
  },

  setParam(id: string, param: string, value: number): void {
    set(
      {
        ...state,
        modules: state.modules.map((m) => (m.id === id ? { ...m, params: { ...m.params, [param]: value } } : m)),
      },
      `${id}:${param}`,
    )
  },

  /** Several params at once (XY morph), as one merged undo step per `key`. */
  setParams(updates: [string, string, number][], key: string): void {
    if (!updates.length) return
    const byMod = new Map<string, Record<string, number>>()
    for (const [id, param, v] of updates) byMod.set(id, { ...byMod.get(id), [param]: v })
    set(
      {
        ...state,
        modules: state.modules.map((m) => (byMod.has(m.id) ? { ...m, params: { ...m.params, ...byMod.get(m.id) } } : m)),
      },
      key,
    )
  },

  /** Store (or clear, with null) one XY morph corner. */
  setMorphCorner(id: string, corner: number, snap: MorphSnapshot | null): void {
    set({
      ...state,
      modules: state.modules.map((m) => {
        if (m.id !== id) return m
        const morph = [...(m.morph ?? [null, null, null, null])]
        morph[corner] = snap
        return { ...m, morph }
      }),
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

  recolorCable(id: string, color: string): void {
    set({ ...state, cables: state.cables.map((c) => (c.id === id ? { ...c, color } : c)) })
  },

  /** Re-insert a cable exactly as it was (cancelled drag). */
  restoreCable(cable: Cable): void {
    if (state.cables.some((c) => c.to.mod === cable.to.mod && c.to.jack === cable.to.jack)) return
    set({ ...state, cables: [...state.cables, cable] })
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
