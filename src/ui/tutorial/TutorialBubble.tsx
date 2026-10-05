import { useEffect, useState, useSyncExternalStore } from 'react'
import { patchStore } from '../../patch/store'
import { tutorial } from '../../tutorial/runner'
import { rackWidth } from '../geometry'
import { targetPoint } from './TutorialHighlight'

interface Spot {
  x: number
  y: number
  side: 'right' | 'left' | 'below' | 'above'
}

const GAP = 18
const WIDTH = 230

/** The help bubble: the step's instruction, floating next to the control you
 *  need (the first target), in screen space so it stays readable at any zoom.
 *  Follows the rack as it scrolls and zooms. */
export function TutorialBubble() {
  const st = useSyncExternalStore(
    (f) => tutorial.subscribe(f),
    () => tutorial.state,
  )
  const step = st.lesson?.steps[st.index] ?? null
  const targets = st.done ? [] : tutorial.targets(step)
  const [spot, setSpot] = useState<Spot | null>(null)

  useEffect(() => {
    if (!targets.length || !step?.task) {
      setSpot(null)
      return
    }
    let raf = 0
    const place = () => {
      raf = requestAnimationFrame(place)
      const t = targets[0].target
      let x: number
      let y: number
      let r: number
      if ('ui' in t) {
        const b = document.querySelector('.topbar .power')?.getBoundingClientRect()
        if (!b) return
        x = b.left + b.width / 2
        y = b.bottom
        r = 4
        setSpot((s) => (s && s.x === x && s.y === y + r && s.side === 'below' ? s : { x, y: y + r, side: 'below' }))
        return
      }
      const rack = document.querySelector('.rack')
      const pt = targetPoint(patchStore.get(), t)
      if (!rack || !pt) return
      const rr = rack.getBoundingClientRect()
      const zoom = rr.width / rackWidth()
      // A cable step: sit under (or over) the whole span — both rings and the
      // ghost cable's sag — so nothing you need to see is covered.
      const end = targets[1] && targetPoint(patchStore.get(), targets[1].target)
      if (end) {
        const dx = end.x - pt.x
        const dy = end.y - pt.y
        const sag = Math.min(24 + Math.hypot(dx, dy) * 0.3, 280) * 0.75
        const bottom = rr.top + (Math.max(pt.y + pt.r, end.y + end.r, (pt.y + end.y) / 2 + sag) + 12) * zoom
        const top = rr.top + (Math.min(pt.y, end.y) - Math.max(pt.r, end.r) - 12) * zoom
        const cx = Math.min(window.innerWidth - WIDTH / 2 - 8, Math.max(WIDTH / 2 + 8, rr.left + ((pt.x + end.x) / 2) * zoom))
        const below = bottom + 90 < window.innerHeight
        const sy = below ? bottom : top - GAP * 2
        const side = below ? 'below' : 'above'
        setSpot((s) => (s && Math.abs(s.x - cx) < 0.5 && Math.abs(s.y - sy) < 0.5 && s.side === side ? s : { x: cx, y: sy, side }))
        return
      }
      x = rr.left + pt.x * zoom
      y = rr.top + pt.y * zoom
      r = pt.r * zoom
      // right of the control if there's room, otherwise left
      const right = x + r + GAP + WIDTH < window.innerWidth - 8
      const sx = right ? x + r + GAP : x - r - GAP
      const sy = Math.min(window.innerHeight - 90, Math.max(70, y))
      const side = right ? 'right' : 'left'
      setSpot((s) => (s && Math.abs(s.x - sx) < 0.5 && Math.abs(s.y - sy) < 0.5 && s.side === side ? s : { x: sx, y: sy, side }))
    }
    place()
    return () => cancelAnimationFrame(raf)
    // targets are derived from the step: re-run when the step or its state changes
  }, [st.index, st.done, st.lesson])

  if (!spot || !step?.task) return null
  const connect = step.action?.kind === 'connect'
  const style =
    spot.side === 'below'
      ? { left: spot.x - WIDTH / 2, top: spot.y + GAP }
      : spot.side === 'above'
        ? { left: spot.x - WIDTH / 2, top: spot.y, transform: 'translateY(-100%)' }
        : spot.side === 'right'
        ? { left: spot.x, top: spot.y, transform: 'translateY(-50%)' }
        : { left: spot.x - WIDTH, top: spot.y, transform: 'translateY(-50%)' }
  return (
    <div className={`tut-bubble ${spot.side}`} style={{ ...style, width: WIDTH }}>
      {connect && <span className="tut-bubble-hint">Drag from ① to ②</span>}
      {step.task}
    </div>
  )
}
