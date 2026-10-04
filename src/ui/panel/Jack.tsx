import type { MouseEvent, PointerEvent } from 'react'
import type { PanelStyle } from '../../modules/types'

const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i + Math.PI / 6
  return `${(Math.cos(a) * 3.4).toFixed(3)},${(Math.sin(a) * 3.4).toFixed(3)}`
}).join(' ')

interface Props {
  x: number
  y: number
  label: string
  out: boolean
  panel: PanelStyle
  onDown: (e: PointerEvent) => void
  onContext: (e: MouseEvent) => void
}

/** 3.5 mm jack with hex nut. Outputs sit on an inverted plate, as on most hardware. */
export function Jack({ x, y, label, out, panel, onDown, onContext }: Props) {
  return (
    <g
      className="jack"
      transform={`translate(${x} ${y})`}
      onPointerDown={(e) => {
        e.stopPropagation()
        onDown(e)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onContext(e)
      }}
    >
      {out && (
        <rect
          x={-4.7}
          y={label ? -9.9 : -4.7}
          width={9.4}
          height={label ? 14.6 : 9.4}
          rx={1.1}
          fill={panel.fg}
        />
      )}
      {label && (
        <text className="silk" y={-5.4} fill={out ? panel.bg : panel.fg} fontSize={2.2}>
          {label}
        </text>
      )}
      <polygon points={HEX} fill="url(#jack-nut)" stroke="#5a5d61" strokeWidth={0.15} />
      <circle r={2.3} fill="#2c2d30" />
      <circle r={1.55} fill="#050505" />
    </g>
  )
}
