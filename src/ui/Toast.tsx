import { useEffect, useSyncExternalStore } from 'react'

interface ToastMsg {
  id: number
  title: string
  text: string
}

let current: ToastMsg | null = null
let next = 1
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

/** A short message at the bottom of the screen ("what you just got and what
 *  to try"). A new one replaces the old; it goes by itself, or on ✕. */
export const toast = {
  show(title: string, text: string): void {
    current = { id: next++, title, text }
    emit()
  },
  dismiss(): void {
    current = null
    emit()
  },
  get: () => current,
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
}

/** How long a toast stays: long enough to read its how-to. */
const SHOW_MS = 9000

export function Toast() {
  const msg = useSyncExternalStore(toast.subscribe, toast.get)
  useEffect(() => {
    if (!msg) return
    const t = window.setTimeout(() => toast.get()?.id === msg.id && toast.dismiss(), SHOW_MS)
    return () => window.clearTimeout(t)
  }, [msg])
  if (!msg) return null
  return (
    <div className="toast" role="status">
      <div className="toast-title">{msg.title}</div>
      <div className="toast-text">{msg.text}</div>
      <button className="toast-x" onClick={toast.dismiss} title="Dismiss">
        ✕
      </button>
    </div>
  )
}
