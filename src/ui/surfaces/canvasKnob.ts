import { useEffect, useRef, type RefObject } from 'react'
import type { ParamSpec } from '../../modules/types'
import { dragKnob, knobAngle, knobHow, knobTicks, turnsKnob, wheelTurner } from '../panel/knobModel'
import { controlHover } from '../rack/controlHover'
import { holdForTip } from '../rack/touchHold'

/** A knob painted on a surface canvas (the POCKETs' A/B knobs, …). It looks
 *  like its surface, but behaves exactly like a panel knob: the same ticks,
 *  left- or middle-drag, scroll (Shift: fine), double-click to reset and the
 *  same tooltip, all from knobModel. */
export interface CanvasKnob {
  /** Centre as fractions of the canvas, radius as a fraction of its height. */
  fx: number
  fy: number
  fr: number
  ps: ParamSpec
  value: number
  set: (v: number) => void
  label?: string
  /** Double-click: defaults to setting the param's default. */
  reset?: () => void
}

/** Paint one: ticks round the outside, the body and the pointer. */
export function drawCanvasKnob(
  ctx: CanvasRenderingContext2D,
  k: CanvasKnob,
  W: number,
  H: number,
  style: { body: string; pointer: string; ticks: string },
): void {
  const cx = k.fx * W
  const cy = k.fy * H
  const r = k.fr * H
  ctx.strokeStyle = style.ticks
  for (const t of knobTicks(k.ps)) {
    const a = (t.angle * Math.PI) / 180 - Math.PI / 2
    const r1 = r * 1.18
    const r2 = r * (t.major ? 1.42 : 1.32)
    ctx.lineWidth = t.major ? 2.2 : 1.6
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2)
    ctx.stroke()
  }
  ctx.fillStyle = style.body
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  const a = (knobAngle(k.ps, k.value) * Math.PI) / 180 - Math.PI / 2
  ctx.strokeStyle = style.pointer
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8)
  ctx.stroke()
}

/** The knob under a pointer (with a little slop), if any. */
function knobAt(knobs: CanvasKnob[], canvas: HTMLCanvasElement, clientX: number, clientY: number): CanvasKnob | null {
  const b = canvas.getBoundingClientRect()
  const fx = (clientX - b.left) / b.width
  const fy = (clientY - b.top) / b.height
  for (const k of knobs) {
    const dx = (fx - k.fx) * b.width
    const dy = (fy - k.fy) * b.height
    if (Math.hypot(dx, dy) < k.fr * b.height * 1.5) return k
  }
  return null
}

/** Wire a surface's canvas knobs: wheel and double-click are handled here;
 *  call the returned `pressKnob` first in the surface's pointerdown, and it
 *  returns true if it took the press (left or middle button on a knob). Also
 *  reports the knob under the pointer to the control readout (the tooltip). */
export function useCanvasKnobs(canvas: RefObject<HTMLCanvasElement | null>, mod: string, knobs: () => CanvasKnob[]) {
  const latest = useRef(knobs)
  latest.current = knobs

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const turn = wheelTurner()
    const wheel = (e: WheelEvent) => {
      const k = knobAt(latest.current(), el, e.clientX, e.clientY)
      if (!k) return
      e.preventDefault()
      e.stopPropagation()
      const next = turn(e, k.ps, k.value)
      if (next !== null) k.set(next) // the readout follows (it reads the value live)
    }
    const dbl = (e: MouseEvent) => {
      const k = knobAt(latest.current(), el, e.clientX, e.clientY)
      if (!k) return
      e.stopPropagation()
      if (k.reset) k.reset()
      else k.set(k.ps.def)
    }
    const hover = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return // a finger holds still for the tooltip (pressKnob)
      const k = e.buttons ? null : knobAt(latest.current(), el, e.clientX, e.clientY)
      if (!k) return controlHover.set(null)
      const id = k.ps.id
      const read = () => latest.current().find((n) => n.ps.id === id)?.value ?? k.value
      controlHover.set({ mod, ps: k.ps, label: k.label, read, how: knobHow(k.ps), x: e.clientX, y: e.clientY })
    }
    const leave = (e: PointerEvent) => e.pointerType !== 'touch' && controlHover.set(null)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('dblclick', dbl)
    el.addEventListener('pointermove', hover)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('dblclick', dbl)
      el.removeEventListener('pointermove', hover)
      el.removeEventListener('pointerleave', leave)
    }
  }, [canvas, mod])

  return (e: { button: number; clientX: number; clientY: number; pointerType?: string; stopPropagation(): void; preventDefault(): void }): boolean => {
    const el = canvas.current
    if (!el || !turnsKnob(e)) return false
    const k = knobAt(latest.current(), el, e.clientX, e.clientY)
    if (!k) return false
    e.stopPropagation()
    e.preventDefault()
    controlHover.set(null)
    // a finger: it turns once it moves; held still, the knob's tooltip
    if (e.pointerType === 'touch') {
      const show = () => controlHover.set({ mod, ps: k.ps, label: k.label, read: () => k.value, how: knobHow(k.ps), x: e.clientX, y: e.clientY - 40 })
      holdForTip(e, show, () => controlHover.set(null), (ev) => dragKnob(ev, k.ps, k.value, k.set))
      return true
    }
    dragKnob(e, k.ps, k.value, k.set)
    return true
  }
}
