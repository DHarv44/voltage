import { useEffect, useSyncExternalStore } from 'react'
import { SPECS } from '../../modules'
import { patchStore } from '../../patch/store'
import type { Patch } from '../../patch/types'
import { tutorial } from '../../tutorial/runner'
import type { Target } from '../../tutorial/types'
import { jackPos, moduleLeft, PX, rowTop, type Pt } from '../geometry'
import { cablePath } from '../rack/CableLayer'
import { libTarget } from './libTarget'

/** Where a target sits in rack space, and how big a ring it needs. */
export function targetPoint(p: Patch, t: Target): (Pt & { r: number }) | null {
  if ('ui' in t || 'lib' in t) return null
  const m = p.modules.find((x) => x.id === tutorial.id(t.mod))
  if (!m) return null
  if ('jack' in t) {
    const pt = jackPos(m, t.jack, t.dir)
    return pt && { ...pt, r: 7 * PX }
  }
  const c = SPECS[m.type].controls.find((k) => (k.kind === 'knob' || k.kind === 'switch') && k.param === t.param)
  if (!c || !('x' in c)) return null
  return { x: moduleLeft(m.hp) + c.x * PX, y: rowTop(m.row) + c.y * PX, r: 9 * PX }
}

/** Rack-space overlay for the current step: a pulsing ring on every target
 *  (numbered 1 → 2 for a cable) and, for a cable, a dotted ghost of the cable
 *  you're about to patch, hanging along the same curve a real one would. */
export function TutorialHighlight({ width, height }: { width: number; height: number }) {
  const st = useSyncExternalStore(
    (f) => tutorial.subscribe(f),
    () => tutorial.state,
  )
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get)
  const step = st.lesson?.steps[st.index] ?? null
  const targets = st.done ? [] : tutorial.targets(step)
  const power = targets.some((t) => 'ui' in t.target)
  const lib = targets.map((t) => t.target).find((t): t is { lib: string } => 'lib' in t)?.lib ?? null

  useEffect(() => {
    const btn = document.querySelector('.topbar .power')
    btn?.classList.toggle('tut-glow', power)
    return () => btn?.classList.remove('tut-glow')
  }, [power])

  // The module's row in the library glows (or its section header, until opened).
  useEffect(() => {
    if (!lib) return
    let lit: Element | null = null
    const update = () => {
      const el = libTarget(lib)?.el ?? null
      if (el === lit) return
      lit?.classList.remove('tut-glow')
      el?.classList.add('tut-glow')
      el?.scrollIntoView({ block: 'nearest' })
      lit = el
    }
    update()
    const timer = window.setInterval(update, 200)
    return () => {
      window.clearInterval(timer)
      lit?.classList.remove('tut-glow')
    }
  }, [lib])

  if (!targets.length) return null
  const pts = targets.map((t) => ({ ...t, pt: targetPoint(patch, t.target) }))
  const ends = step?.action?.kind === 'connect' && pts[0].pt && pts[1]?.pt ? [pts[0].pt, pts[1].pt] : null

  return (
    <>
      {ends && (
        <svg className="tut-ghost" width={width} height={height}>
          <path d={cablePath(ends[0], ends[1])} />
        </svg>
      )}
      {pts.map(({ pt, label }, i) =>
        pt ? (
          <div key={i} className="tut-ring" style={{ left: pt.x - pt.r, top: pt.y - pt.r, width: pt.r * 2, height: pt.r * 2 }}>
            {label && <span className="tut-ring-label">{label}</span>}
          </div>
        ) : null,
      )}
    </>
  )
}
