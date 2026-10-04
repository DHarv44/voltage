import { SPECS } from '../../modules'
import type { ModuleInst, Patch } from '../../patch/types'
import { jackPos, type Placement, type Pt } from '../geometry'
import type { CableDrag } from './useRackInteractions'

interface Props {
  patch: Patch
  /** Where each module is drawn right now (mid-drag positions included). */
  place: (m: ModuleInst) => Placement
  drag: CableDrag | null
  opacity: number
  width: number
  height: number
}

/** Patch cables hang under gravity: sag grows with length. */
export function CableLayer({ patch, place, drag, opacity, width, height }: Props) {
  const byId = new Map(patch.modules.map((m) => [m.id, m]))
  const pos = (mod: string, jack: string, dir: 'in' | 'out') => {
    const m = byId.get(mod)
    return m ? jackPos(m, jack, dir, place(m)) : null
  }

  let dragStart: Pt | null = null
  if (drag) dragStart = pos(drag.anchor.mod, drag.anchor.jack, drag.anchorDir)

  return (
    <svg className="cables" width={width} height={height}>
      <g opacity={opacity}>
        {patch.cables.map((c) => {
          const a = pos(c.from.mod, c.from.jack, 'out')
          const b = pos(c.to.mod, c.to.jack, 'in')
          const src = byId.get(c.from.mod)
          const poly = !!src && !!SPECS[src.type]?.outputs.find((j) => j.id === c.from.jack)?.poly
          return a && b ? <Cable key={c.id} a={a} b={b} color={c.color} poly={poly} /> : null
        })}
      </g>
      {drag && dragStart && <Cable a={dragStart} b={drag} color={drag.color} />}
    </svg>
  )
}

/** Poly cables are drawn thicker with a dark core stripe, like a ribbon of voices. */
function Cable({ a, b, color, poly = false }: { a: Pt; b: Pt; color: string; poly?: boolean }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const sag = Math.min(24 + Math.hypot(dx, dy) * 0.3, 280)
  const d = `M ${a.x} ${a.y} C ${a.x + dx / 3} ${a.y + dy / 3 + sag} ${a.x + (2 * dx) / 3} ${a.y + (2 * dy) / 3 + sag} ${b.x} ${b.y}`
  return (
    <g>
      <path d={d} stroke="rgba(0,0,0,0.35)" strokeWidth={poly ? 11 : 7} fill="none" strokeLinecap="round" transform="translate(2 5)" />
      <path d={d} stroke={color} strokeWidth={poly ? 9 : 5.5} fill="none" strokeLinecap="round" />
      {poly && <path d={d} stroke="rgba(0,0,0,0.45)" strokeWidth={2} fill="none" strokeLinecap="round" />}
      <path d={d} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} fill="none" strokeLinecap="round" transform="translate(-0.8 -1.4)" />
      <Plug p={a} color={color} />
      <Plug p={b} color={color} />
    </g>
  )
}

function Plug({ p, color }: { p: Pt; color: string }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <circle r={11} fill="rgba(0,0,0,0.3)" transform="translate(1.5 3)" />
      <circle r={11} fill="#1d1e20" />
      <circle r={9} fill={color} />
      <circle r={9} fill="url(#knob-body)" opacity={0.45} />
      <circle r={3.6} fill="#2a2b2e" />
    </g>
  )
}
