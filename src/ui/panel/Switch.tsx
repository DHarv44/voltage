import type { ParamSpec } from '../../modules/types'
import { actions } from '../../patch/store'

interface Props {
  mod: string
  ps: ParamSpec
  value: number
  x: number
  y: number
  fg: string
}

/** Bat-handle toggle. Click steps through positions. options[0] is the down position. */
export function Switch({ mod, ps, value, x, y, fg }: Props) {
  const steps = ps.max - ps.min + 1
  const pos = Math.round(value - ps.min)
  const up = steps === 1 ? 0 : pos / (steps - 1)
  const tip = 3.6 - up * 7.2
  const opts = ps.options ?? []
  return (
    <g
      className="switch"
      transform={`translate(${x} ${y})`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        actions.setParam(mod, ps.id, ps.min + ((pos + 1) % steps))
      }}
    >
      <title>{`${ps.label}: ${opts[pos] ?? value}`}</title>
      <rect x={-3.2} y={-5} width={6.4} height={10} fill="transparent" />
      {opts[steps - 1] && (
        <text className="silk" y={-6.3} fill={fg} fontSize={2}>
          {opts[steps - 1]}
        </text>
      )}
      {steps === 3 && opts[1] && (
        <text className="silk" x={3.6} y={0.7} fill={fg} fontSize={2} textAnchor="start">
          {opts[1]}
        </text>
      )}
      {opts[0] && (
        <text className="silk" y={8.2} fill={fg} fontSize={2}>
          {opts[0]}
        </text>
      )}
      <circle r={2.6} fill="url(#jack-nut)" stroke="#5a5d61" strokeWidth={0.15} />
      <circle r={1.6} fill="#3a3b3e" />
      <line x1={0} y1={0} x2={0} y2={tip} stroke="#d5d7da" strokeWidth={1.3} strokeLinecap="round" />
      <circle cy={tip} r={0.95} fill="#eceef0" stroke="#8c8f93" strokeWidth={0.15} />
    </g>
  )
}
