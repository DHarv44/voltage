import { useEffect, useRef, useState } from 'react'

/** A dropdown's open state: closes on a click outside `root` or on Escape.
 *  Every top-bar menu uses it, so they all behave the same. */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false)
  const root = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])
  return { open, setOpen, toggle: () => setOpen((o) => !o), root }
}
