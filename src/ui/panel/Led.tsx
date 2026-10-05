import { useEffect, useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { LED } from '../../modules/panelMetrics'

interface Props {
  mod: string
  index: number
  x: number
  y: number
  color?: string
  bipolar?: boolean
}

const POS = '#3bff6b'
const NEG = '#ff3b2f'

/** Painted straight from telemetry (no React re-render per frame). */
export function Led({ mod, index, x, y, color = NEG, bipolar }: Props) {
  const ref = useRef<SVGCircleElement>(null)

  useEffect(
    () =>
      telemetry.subscribe(() => {
        const el = ref.current
        if (!el) return
        const v = telemetry.leds[mod]?.[index] ?? 0
        if (bipolar) el.setAttribute('fill', v >= 0 ? POS : NEG)
        el.style.opacity = String(Math.min(1, Math.abs(v)))
      }),
    [mod, index, bipolar],
  )

  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <circle r={LED.r} fill="#141414" />
      <circle r={LED.r - 0.4} fill="#3a1d1b" opacity={0.6} />
      <circle ref={ref} r={LED.r - 0.4} fill={color} style={{ opacity: 0, filter: `drop-shadow(0 0 0.8px ${color})` }} />
    </g>
  )
}
