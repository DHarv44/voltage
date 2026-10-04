import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react'
import { engine } from '../../audio/engine'
import { telemetry } from '../../audio/telemetry'
import { XYL } from '../../modules/specs/xy'
import { actions, patchStore } from '../../patch/store'
import type { MorphSnapshot } from '../../patch/types'
import { PX } from '../geometry'
import { track } from '../pointer'
import { paintPad, pushTrail, type Trail } from '../xy/draw'
import { blend, captureSnapshot } from '../xy/morph'

interface Props {
  mod: string
  x: number
  y: number
  w: number
  h: number
  scale: number
  range: number
  morph: boolean
  corners: (MorphSnapshot | null)[] | undefined
}

const RES = 2
/** Mouse "pressure" when the device can't sense it; the wheel changes it while held. */
const MOUSE_PRES = 0.6
const CORNERS = ['A', 'B', 'C', 'D']

/** The pad surface. Left-drag plays it (it never moves the panel); pens and
 *  touch screens give real pressure, a mouse uses the wheel while held. The
 *  corner chips store knob snapshots for MORPH (click = store, right-click = clear). */
export function XyPad({ mod, x, y, w, h, scale, range, morph, corners }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const trail = useRef<Trail>([])
  const look = useRef({ scale, range, morph, corners: [false, false, false, false] })
  look.current = { scale: Math.round(scale), range: Math.round(range), morph, corners: CORNERS.map((_, i) => !!corners?.[i]) }
  const morphState = useRef({ corners, lx: -1, ly: -1 })
  morphState.current.corners = corners
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useEffect(() => {
    const draw = () => {
      const ctx = ref.current?.getContext('2d')
      const led = telemetry.leds[mod]
      const now = performance.now() / 1000
      if (led) pushTrail(trail.current, led[XYL.x], led[XYL.y], now)
      if (ctx) paintPad(ctx, W, H, led, trail.current, look.current, now)
      // MORPH: the dot blends the corner snapshots into the rack's knobs.
      const ms = morphState.current
      if (led && look.current.morph && ms.corners && Math.hypot(led[XYL.x] - ms.lx, led[XYL.y] - ms.ly) > 0.003) {
        ms.lx = led[XYL.x]
        ms.ly = led[XYL.y]
        actions.setParams(blend(patchStore.get(), ms.corners, ms.lx, ms.ly), `morph:${mod}`)
      }
    }
    draw()
    return telemetry.subscribe(draw)
  }, [mod, W, H])

  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    let pres = e.pointerType === 'mouse' || !e.pressure ? MOUSE_PRES : e.pressure
    const send = (cx: number, cy: number, p: number, on: boolean) =>
      engine.ui(mod, {
        kind: 'xy',
        x: Math.min(1, Math.max(0, (cx - r.left) / r.width)),
        y: Math.min(1, Math.max(0, 1 - (cy - r.top) / r.height)),
        p,
        down: on,
      })
    let at = { x: e.clientX, y: e.clientY }
    send(at.x, at.y, pres, true)
    const wheel = (ev: WheelEvent) => {
      ev.preventDefault()
      pres = Math.min(1, Math.max(0, pres - ev.deltaY / 1000))
      send(at.x, at.y, pres, true)
    }
    window.addEventListener('wheel', wheel, { passive: false })
    track(
      (ev) => {
        at = { x: ev.clientX, y: ev.clientY }
        if (ev.pointerType !== 'mouse' && ev.pressure) pres = ev.pressure
        send(at.x, at.y, pres, true)
      },
      () => {
        window.removeEventListener('wheel', wheel)
        send(at.x, at.y, 0, false)
      },
    )
  }

  return (
    <div className="xy-pad" style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}>
      <canvas ref={ref} width={W} height={H} onPointerDown={down} onContextMenu={(e) => e.preventDefault()} />
      {CORNERS.map((c, i) => (
        <button
          key={c}
          className={`xy-corner c${i}${corners?.[i] ? ' set' : ''}`}
          title={`Morph corner ${c}: click stores every knob in the rack, right-click clears`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => actions.setMorphCorner(mod, i, captureSnapshot(patchStore.get()))}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            actions.setMorphCorner(mod, i, null)
          }}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
