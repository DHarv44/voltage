import { useSyncExternalStore } from 'react'
import { sanitize } from './persist'
import type { Patch } from './types'

/** Your own named patches, kept in this browser. */
export interface SavedPatch {
  name: string
  savedAt: number
  patch: Patch
}

const KEY = 'voltage.library.v1'
const subs = new Set<() => void>()

function read(): SavedPatch[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedPatch[]
    return raw.filter((e) => typeof e?.name === 'string' && sanitize(e.patch))
  } catch {
    return []
  }
}

let entries = read()

function write(next: SavedPatch[]): boolean {
  entries = next
  subs.forEach((f) => f())
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    return true
  } catch {
    return false // storage full or blocked: the list still works for this session
  }
}

export const patchLibrary = {
  list: (): SavedPatch[] => entries,
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },
  /** Save (or overwrite) a named patch. Returns false if it couldn't be persisted. */
  save(name: string, patch: Patch): boolean {
    const clean = name.trim().slice(0, 60)
    if (!clean) return false
    const rest = entries.filter((e) => e.name !== clean)
    return write([{ name: clean, savedAt: Date.now(), patch }, ...rest])
  },
  remove(name: string): void {
    write(entries.filter((e) => e.name !== name))
  },
  has: (name: string): boolean => entries.some((e) => e.name === name.trim()),
}

export function useLibrary(): SavedPatch[] {
  return useSyncExternalStore(patchLibrary.subscribe, patchLibrary.list)
}
