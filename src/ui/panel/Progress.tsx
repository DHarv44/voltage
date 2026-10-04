import { useEffect, useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import type { PanelStyle } from '../../modules/types'

/** Thin position bar (e.g. loop playhead) painted straight from telemetry. */
export function Progress({ mod, x, y, w, led, panel }: { mod: string; x: number; y: number; w: number; led: number; panel: PanelStyle }) {
  const fill = useRef<SVGRectElement>(null)
  useEffect(
    () =>
      telemetry.subscribe(() => {
        const v = Math.min(1, Math.max(0, telemetry.leds[mod]?.[led] ?? 0))
        fill.current?.setAttribute('width', String(w * v))
      }),
    [mod, led, w],
  )
  return (
    <g pointerEvents="none">
      <rect x={x} y={y - 0.9} width={w} height={1.8} rx={0.9} fill="#0b0b0b" stroke="#444" strokeWidth={0.15} />
      <rect ref={fill} x={x} y={y - 0.9} width={0} height={1.8} rx={0.9} fill={panel.accent} />
    </g>
  )
}
