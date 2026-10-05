import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { engine } from '../../audio/engine'
import { telemetry } from '../../audio/telemetry'
import type { PanelStyle } from '../../modules/types'
import { track } from '../pointer'
import { PLATE } from '../../modules/panelMetrics'

interface Props {
  mod: string
  index: number
  x: number
  y: number
  w: number
  h: number
  label?: string
  led?: number
  panel: PanelStyle
}

/** Brass touch plate. Press and drag: horizontal = position, vertical =
 *  pressure (higher up = pressing harder), streamed while held. */
export function Plate({ mod, index, x, y, w, h, label, led, panel }: Props) {
  const glow = useRef<SVGRectElement>(null)
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (led === undefined) return
    return telemetry.subscribe(() => {
      const v = telemetry.leds[mod]?.[led] ?? 0
      if (glow.current) glow.current.style.opacity = String(Math.min(1, v) * 0.7)
    })
  }, [mod, led])

  const down = (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const at = (cx: number, cy: number) => ({
      x: Math.min(1, Math.max(0, (cx - r.left) / r.width)),
      y: Math.min(1, Math.max(0, 1 - (cy - r.top) / r.height)),
    })
    const first = at(e.clientX, e.clientY)
    engine.ui(mod, { kind: 'touch', index, ...first, down: true })
    setTouch(first)
    track(
      (ev) => {
        const t = at(ev.clientX, ev.clientY)
        engine.ui(mod, { kind: 'touch', index, ...t, down: true })
        setTouch(t)
      },
      () => {
        engine.ui(mod, { kind: 'touch', index, x: 0, y: 0, down: false })
        setTouch(null)
      },
    )
  }

  return (
    <g className="plate" transform={`translate(${x} ${y})`} onPointerDown={down}>
      <title>{`${label ?? 'Touch plate'}: press and slide (across = position, up = pressure)`}</title>
      <rect width={w} height={h} rx={1} fill="url(#plate-brass)" stroke="#5a4210" strokeWidth={0.25} />
      <rect ref={glow} width={w} height={h} rx={1} fill={panel.accent} style={{ opacity: 0 }} pointerEvents="none" />
      {touch && <circle cx={touch.x * w} cy={(1 - touch.y) * h} r={1.6} fill="#fff" opacity={0.85} pointerEvents="none" />}
      {label && (
        <text className="silk" x={w / 2} y={h + PLATE.labelGap} fill={panel.fg} fontSize={PLATE.labelSize}>
          {label}
        </text>
      )}
    </g>
  )
}
