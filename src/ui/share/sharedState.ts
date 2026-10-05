import { useSyncExternalStore } from 'react'
import { SCRATCH } from '../../patch/persist'
import { openShared, sharedInHash, type Shared } from '../../patch/share'
import { actions } from '../../patch/store'

/** The shared patch this page was opened with: loading, opened, or broken. */
export type SharedState = { kind: 'none' } | { kind: 'loading' } | { kind: 'bad' } | ({ kind: 'open' } & Shared)

let state: SharedState = { kind: 'none' }
const subs = new Set<() => void>()
const set = (s: SharedState) => {
  state = s
  subs.forEach((f) => f())
}

export const sharedPatch = {
  get: () => state,
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
  dismiss: () => set({ kind: 'none' }),
}

export function useShared(): SharedState {
  return useSyncExternalStore(sharedPatch.subscribe, sharedPatch.get)
}

/** Called once at startup. A shared link always opens in a scratch rack, so
 *  the friend's own saved rack is never touched: if this page isn't one yet,
 *  reload as one (returns true: don't start the app on this page). */
export function bootShared(): boolean {
  const data = sharedInHash()
  if (!data) return false
  if (!SCRATCH) {
    location.replace(`${location.pathname}?scratch${location.hash}`)
    return true
  }
  set({ kind: 'loading' })
  void openShared(data).then((s) => {
    if (!s) return set({ kind: 'bad' })
    actions.load(s.patch)
    set({ kind: 'open', ...s })
  })
  return false
}
