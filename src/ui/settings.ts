import { useSyncExternalStore } from 'react'

export interface Settings {
  /** null = fit rack to window width */
  zoom: number | null
  cableOpacity: number
  /** Library sections the user has open (by category name, plus 'help'). */
  libOpen: string[]
  /** The library is folded away to a thin rail. */
  libHidden: boolean
  /** Library: starred modules (in the order starred) and the last few added. */
  favs: string[]
  recent: string[]
  /** Library tag filter (all must match). */
  libTags: string[]
  /** While dragging a cable, light every jack it could go to. */
  jackHints: boolean
  /** Plain-words explanations in the tooltips (what a gate is, what V/OCT means…). */
  explain: boolean
  /** Analog imperfections (engine options). */
  psuSag: boolean
  crosstalk: boolean
}

const KEY = 'voltage.settings.v1'
const DEFAULTS: Settings = {
  zoom: null,
  cableOpacity: 0.85,
  libOpen: ['Systems'],
  libHidden: false,
  favs: [],
  recent: [],
  libTags: [],
  jackHints: true,
  explain: true,
  psuSag: false,
  crosstalk: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

let state = load()
const subs = new Set<() => void>()

export const settings = {
  get: () => state,
  subscribe(fn: () => void) {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },
  set(patch: Partial<Settings>) {
    state = { ...state, ...patch }
    subs.forEach((f) => f())
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* not persisted */
    }
  },
}

export function useSettings(): Settings {
  return useSyncExternalStore(settings.subscribe, settings.get)
}
