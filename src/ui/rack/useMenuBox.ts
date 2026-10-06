import { useEffect, useLayoutEffect, useRef } from 'react'

/** Shared behaviour for the rack's pop-up menus: closes on a click elsewhere
 *  or any key, and keeps the whole menu on screen (opening up or left of the
 *  pointer if it would run off). Put the returned ref on the menu element. */
export function useMenuBox(x: number, y: number, onClose: () => void) {
  useEffect(() => {
    const close = () => onClose()
    const t = window.setTimeout(() => window.addEventListener('pointerdown', close), 0)
    window.addEventListener('keydown', close)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [onClose])

  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`
    el.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`
  }, [x, y])
  return box
}
