import { useEffect, useRef, type RefObject } from 'react'
import { engine } from '../../audio/engine'
import type { ModuleSpec } from '../../modules/types'
import type { ModuleInst } from '../../patch/types'

/** What every instrument surface gets from the panel. */
export interface SurfaceProps {
  inst: ModuleInst
  spec: ModuleSpec
  /** Surface rectangle in panel millimetres. */
  x: number
  y: number
  w: number
  h: number
}

/** Canvas oversampling for crisp drawing at rack zoom. */
export const RES = 2

export function sendSurface(mod: string, name: string, x: number, y: number, down: boolean): void {
  engine.ui(mod, { kind: 'surface', name, x, y, down })
}

/** requestAnimationFrame loop that only runs while the canvas is on screen
 *  (spinning platters and vibrating strings draw at display rate). */
export function useFrame(ref: RefObject<HTMLElement | null>, draw: (now: number, dt: number) => void): void {
  const fn = useRef(draw)
  fn.current = draw
  useEffect(() => {
    let raf = 0
    let last = 0
    let visible = true
    const el = ref.current
    const io = el ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null
    if (el) io!.observe(el)
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const now = t / 1000
      const dt = last ? Math.min(0.05, now - last) : 1 / 60
      last = now
      if (visible) fn.current(now, dt)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      io?.disconnect()
    }
  }, [ref])
}
