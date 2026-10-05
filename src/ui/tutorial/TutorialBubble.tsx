import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { patchStore } from '../../patch/store'
import { tutorial } from '../../tutorial/runner'
import { rackWidth, rowTop } from '../geometry'
import { targetPoint } from './TutorialHighlight'
import { libTarget } from './libTarget'

type Side = 'right' | 'left' | 'below' | 'above' | 'centre'
interface Spot {
  left: number
  top: number
  side: Side
  /** Where the arrow points along the bubble's edge (px from its top/left). */
  arrow: number
  /** Something to do first (e.g. open a library section). */
  hint?: string
}

const GAP = 18
const WIDTH = 330
const MARGIN = 10

/** The lesson, right where you're working: a popover beside the control the
 *  step is about (explanation, task, what to listen for, and the buttons).
 *  Cable steps sit under the whole span so neither jack nor the ghost cable is
 *  covered; steps without a control float centred over the rack. Follows the
 *  rack as it scrolls and zooms, and always stays fully on screen. */
export function TutorialBubble() {
  const st = useSyncExternalStore(
    (f) => tutorial.subscribe(f),
    () => tutorial.state,
  )
  const step = st.lesson?.steps[st.index] ?? null
  const [spot, setSpot] = useState<Spot | null>(null)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!step) return
    const targets = tutorial.targets(step)
    let raf = 0
    const place = () => {
      raf = requestAnimationFrame(place)
      const el = box.current
      const h = el?.offsetHeight ?? 200
      const vw = window.innerWidth
      const vh = window.innerHeight
      const clampX = (x: number) => Math.min(vw - WIDTH - MARGIN, Math.max(MARGIN, x))
      const clampY = (y: number) => Math.min(vh - h - MARGIN, Math.max(70, y))
      let next: Spot
      const t = targets[0]?.target
      const rack = document.querySelector('.rack')
      if (t && 'lib' in t) {
        // a module in the library list: just right of its row (or its section)
        const lt = libTarget(t.lib)
        if (!lt) return
        const b = lt.el.getBoundingClientRect()
        const top = clampY(b.top + b.height / 2 - h / 2)
        next = { left: b.right + GAP, top, side: 'right', arrow: b.top + b.height / 2 - top, hint: lt.open ? undefined : `First open ${lt.category.toUpperCase()} in the module list.` }
      } else if (t && 'ui' in t) {
        const b = document.querySelector('.topbar .power')?.getBoundingClientRect()
        if (!b) return
        const left = clampX(b.left + b.width / 2 - WIDTH / 2)
        next = { left, top: b.bottom + GAP, side: 'below', arrow: b.left + b.width / 2 - left }
      } else if (t && rack) {
        const rr = rack.getBoundingClientRect()
        const zoom = rr.width / rackWidth()
        const a = targetPoint(patchStore.get(), t)
        if (!a) return
        const ax = rr.left + a.x * zoom
        const ay = rr.top + a.y * zoom
        const ar = a.r * zoom
        const p = patchStore.get()
        const b = targets[1] && targetPoint(p, targets[1].target)
        // Prefer the space just below the module row(s) involved, so the whole
        // panel (and the scope you're watching) stays visible; the arrow lines
        // up with the control. A cable also clears the ghost cable's sag.
        const rowOf = (tt: (typeof targets)[number] | undefined) => {
          const tg = tt?.target
          return tg && 'mod' in tg ? (p.modules.find((m) => m.id === tutorial.id(tg.mod))?.row ?? 0) : 0
        }
        const row = Math.max(rowOf(targets[0]), rowOf(targets[1]))
        let bottom = rr.top + rowTop(row + 1) * zoom
        let cx = ax
        let top = ay - ar - GAP
        if (b) {
          const bx = rr.left + b.x * zoom
          const by = rr.top + b.y * zoom
          const sag = Math.min(24 + Math.hypot(b.x - a.x, b.y - a.y) * 0.3, 280) * 0.75 * zoom
          bottom = Math.max(bottom, (ay + by) / 2 + sag)
          cx = (ax + bx) / 2
          top = Math.min(ay, by) - Math.max(ar, b.r * zoom) - GAP
        }
        bottom += GAP
        const left = clampX(cx - WIDTH / 2)
        if (bottom + h < vh - MARGIN) next = { left, top: bottom, side: 'below', arrow: cx - left }
        else if (b || top - h > 70) next = { left, top: clampY(top - h), side: 'above', arrow: cx - left }
        else {
          // no room above or below: beside the control
          const right = ax + ar + GAP + WIDTH < vw - MARGIN
          const sl = right ? ax + ar + GAP : ax - ar - GAP - WIDTH
          const st2 = clampY(ay - h / 2)
          next = { left: clampX(sl), top: st2, side: right ? 'right' : 'left', arrow: ay - st2 }
        }
      } else {
        // no control: centred over the rack's visible area
        const area = document.querySelector('.rack-scroll')?.getBoundingClientRect()
        const cx = area ? area.left + area.width / 2 : vw / 2
        const cy = area ? area.top + Math.min(area.height, vh) * 0.4 : vh / 3
        next = { left: clampX(cx - WIDTH / 2), top: clampY(cy - h / 2), side: 'centre', arrow: 0 }
      }
      setSpot((s) => (s && Math.abs(s.left - next.left) < 0.5 && Math.abs(s.top - next.top) < 0.5 && s.side === next.side && s.hint === next.hint ? s : next))
    }
    place()
    return () => cancelAnimationFrame(raf)
  }, [st.index, st.lesson, step])

  if (!st.lesson || !step) return null
  const last = st.index === st.lesson.steps.length - 1
  const guided = st.mode === 'guided'
  const waiting = guided && ((!!step.action && !st.done) || !!st.playPrompt)
  const connect = step.action?.kind === 'connect'
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    await fn()
    setBusy(false)
  }

  return (
    <div
      ref={box}
      className={`tut-bubble ${spot?.side ?? 'centre'}`}
      style={{ left: spot?.left ?? -9999, top: spot?.top ?? 0, width: WIDTH, ['--arrow' as string]: `${spot?.arrow ?? 0}px` }}
      role="dialog"
      aria-label={st.lesson.title}
    >
      {st.notice && st.index === 0 && <p className="tut-then">↪ {st.notice}</p>}
      <p className="tut-text">{step.text}</p>
      {step.task && (
        // Guided: your instruction (moves on by itself once you've done it).
        // Walkthrough: what the tutorial is doing for you right now.
        <p className={st.done ? 'tut-task done' : 'tut-task'}>
          {st.done ? '✓ ' : guided ? '' : '▶ '}
          {guided && connect && !st.done && <span className="tut-hint">Drag from ① to ②</span>}
          {guided && spot?.hint && !st.done && <span className="tut-hint">{spot.hint}</span>}
          {step.task}
        </p>
      )}
      {/* guided says up front what to listen for, so there's no "success" stop */}
      {step.listen && (st.done || (guided && step.action)) && <p className="tut-listen">🎧 {step.listen}</p>}
      {st.playPrompt && <p className="tut-task">🎹 Now play a note (keys A S D F G H J K) to hear the difference.</p>}
      {step.thenNote && st.done && !guided && <p className="tut-then">↪ {step.thenNote}</p>}
      <div className="tut-buttons">
        <button onClick={() => void run(() => tutorial.back())} disabled={st.index === 0 || busy}>
          Back
        </button>
        {waiting && (
          <button onClick={() => void run(() => tutorial.showMe())} disabled={busy} title="Do this step for me">
            Show me
          </button>
        )}
        {last ? (
          <>
            <button className={tutorial.nextLesson ? '' : 'primary'} onClick={() => tutorial.finish()} title="End the lesson and keep playing with the rack you built">
              Finish
            </button>
            {tutorial.nextLesson && (
              <button className="primary" onClick={() => void run(() => tutorial.continueNext())} disabled={busy} title={`Carry on with this rack: ${tutorial.nextLesson.title}`}>
                Next lesson →
              </button>
            )}
          </>
        ) : (
          !(guided && step.action) && (
            <button className="primary" onClick={() => void run(() => tutorial.next())} disabled={busy}>
              Next
            </button>
          )
        )}
      </div>
    </div>
  )
}
