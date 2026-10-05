import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { engine } from '../../audio/engine'
import { telemetry } from '../../audio/telemetry'
import type { PanelStyle } from '../../modules/types'
import { track } from '../pointer'
import { PAD } from '../../modules/panelMetrics'

interface Props {
  mod: string
  index: number
  x: number
  y: number
  size: number
  label?: string
  sub?: string
  led?: number
  panel: PanelStyle
}

/** Rubber drum pad. Velocity comes from where you strike it: the top edge is
 *  full force (127), the bottom edge soft (~40). Glows from its LED. */
export function Pad({ mod, index, x, y, size, label, sub, led, panel }: Props) {
  const glow = useRef<SVGRectElement>(null)
  const [pressed, setPressed] = useState(false)
  const h = size / 2

  useEffect(() => {
    if (led === undefined) return
    return telemetry.subscribe(() => {
      const v = telemetry.leds[mod]?.[led] ?? 0
      if (glow.current) glow.current.style.opacity = String(Math.min(1, v) * 0.85)
    })
  }, [mod, led])

  const down = (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    const vel = Math.round(127 - frac * 87)
    engine.ui(mod, { kind: 'pad', index, vel, down: true })
    setPressed(true)
    track(
      () => {},
      () => {
        engine.ui(mod, { kind: 'pad', index, vel: 0, down: false })
        setPressed(false)
      },
    )
  }

  return (
    <g className="pad" transform={`translate(${x} ${y}) scale(${pressed ? 0.96 : 1})`} onPointerDown={down}>
      <title>{`${sub ?? label ?? 'Pad'}: hit it (higher up = harder)`}</title>
      <rect x={-h - PAD.rim} y={-h - PAD.rim} width={size + PAD.rim * 2} height={size + PAD.rim * 2} rx={1.6} fill="#0d0d0d" />
      <rect x={-h} y={-h} width={size} height={size} rx={1.3} fill="url(#pad-rubber)" stroke="#000" strokeWidth={0.2} />
      <rect ref={glow} x={-h} y={-h} width={size} height={size} rx={1.3} fill={panel.accent} style={{ opacity: 0 }} pointerEvents="none" />
      {label && (
        <text className="silk" x={-h + 1.6} y={-h + 2.6} fill={panel.fg} fontSize={1.8} textAnchor="start" opacity={0.7}>
          {label}
        </text>
      )}
      {sub && (
        <text className="silk" y={1} fill={panel.fg} fontSize={size > 12 ? 3 : 2.4} opacity={0.85}>
          {sub}
        </text>
      )}
    </g>
  )
}
