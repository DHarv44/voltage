import { memo } from 'react'
import { KNOB } from '../../modules/panelMetrics'
import { HP_MM, PANEL_H_MM, type ModuleSpec } from '../../modules/types'

/** A module's panel in miniature, drawn from its spec: the colours, where
 *  its knobs, jacks, switches and screens sit. Recognisable at a glance and
 *  cheap (no surfaces or screens actually run). `height` in CSS pixels. */
export const PanelThumb = memo(function PanelThumb({ spec, height }: { spec: ModuleSpec; height: number }) {
  const w = spec.hp * HP_MM
  const ink = spec.panel.fg
  const shapes = spec.controls.map((c, i) => {
    switch (c.kind) {
      case 'knob':
        return <circle key={i} cx={c.x} cy={c.y} r={KNOB.r[c.size ?? 'M']} fill="#2a2a2a" stroke={ink} strokeWidth={0.5} />
      case 'in':
      case 'out':
        return (
          <g key={i}>
            {c.kind === 'out' && <rect x={c.x - 4} y={c.y - 4} width={8} height={8} rx={1} fill={ink} opacity={0.85} />}
            <circle cx={c.x} cy={c.y} r={2.6} fill="#111" stroke="#9a9a9a" strokeWidth={0.7} />
          </g>
        )
      case 'switch':
      case 'stomp':
        return <rect key={i} x={c.x - 2} y={c.y - 3.5} width={4} height={7} rx={1} fill="#bbb" />
      case 'led':
        return <circle key={i} cx={c.x} cy={c.y} r={1.1} fill={c.color ?? spec.panel.accent} />
      case 'pad':
        return <rect key={i} x={c.x - c.size / 2} y={c.y - c.size / 2} width={c.size} height={c.size} rx={1.5} fill="#3a3a3e" />
      case 'button':
        return <rect key={i} x={c.x - 3.5} y={c.y - 2.5} width={7} height={5} rx={1} fill="#3a3a3e" />
      case 'scope':
      case 'vision':
      case 'xypad':
      case 'surface':
      case 'plate':
        return <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={1.5} fill={c.kind === 'vision' ? '#0b1a24' : '#16181b'} opacity={0.9} />
      case 'steps':
        return null
      default:
        return null
    }
  })
  return (
    <svg className="panel-thumb" viewBox={`0 0 ${w} ${PANEL_H_MM}`} style={{ height, width: (height * w) / PANEL_H_MM }} aria-hidden>
      <rect width={w} height={PANEL_H_MM} rx={1.5} fill={spec.panel.bg} />
      <rect x={1} y={3} width={w - 2} height={0.6} fill={spec.panel.accent} opacity={0.8} />
      <text x={w / 2} y={9.5} textAnchor="middle" fontSize={4.2} fontWeight={700} fill={ink} style={{ textAnchor: 'middle' }}>
        {spec.title.length > w / 2.6 ? spec.title.slice(0, Math.floor(w / 2.6)) : spec.title}
      </text>
      {shapes}
    </svg>
  )
})
