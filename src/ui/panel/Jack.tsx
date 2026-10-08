import type { MouseEvent, PointerEvent } from 'react'
import type { PanelStyle } from '../../modules/types'
import { JACK, jackLabelSize } from '../../modules/panelMetrics'

const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i + Math.PI / 6
  return `${(Math.cos(a) * JACK.nut).toFixed(3)},${(Math.sin(a) * JACK.nut).toFixed(3)}`
}).join(' ')

interface Props {
  x: number
  y: number
  label: string
  out: boolean
  /** An input that already has a cable in it (inputs take one). */
  patched?: boolean
  /** Its signal family (audio / pitch / timing / cv), for the hint colours. */
  family: string
  panel: PanelStyle
  onDown: (e: PointerEvent) => void
  onContext: (e: MouseEvent) => void
  onHover: (e: PointerEvent | null) => void
}

/** 3.5 mm jack with hex nut. Outputs sit on an inverted plate, as on most
 *  hardware. Hovering shows the live voltage (the rack's jack readout).
 *  While a cable is being dragged, the rack's hint classes light the ring
 *  round every jack it could go to (see .jack-hint in styles.css). */
export function Jack({ x, y, label, out, patched, family, panel, onDown, onContext, onHover }: Props) {
  const p = JACK.plate
  return (
    <g
      className={`jack ${out ? 'out' : 'in'} fam-${family}${patched ? ' patched' : ''}`}
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
      onPointerEnter={onHover}
      onPointerMove={onHover}
      onPointerLeave={() => onHover(null)}
    >
      {out && (
        <rect
          x={-p.half}
          y={label ? p.topLabelled : p.top}
          width={p.half * 2}
          height={p.bottom - (label ? p.topLabelled : p.top)}
          rx={1.1}
          fill={panel.fg}
        />
      )}
      {label && (
        <text className="silk" y={JACK.labelY} fill={out ? panel.bg : panel.fg} fontSize={jackLabelSize(label, out)}>
          {label}
        </text>
      )}
      <circle className="jack-hint" r={JACK.nut + 1.2} fill="none" strokeWidth={0.9} pointerEvents="none" />
      <polygon points={HEX} fill="url(#jack-nut)" stroke="#5a5d61" strokeWidth={0.15} />
      <circle r={2.3} fill="#2c2d30" />
      <circle r={1.55} fill="#050505" />
    </g>
  )
}
