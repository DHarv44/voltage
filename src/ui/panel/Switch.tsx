import type { PointerEvent } from 'react'
import type { ParamSpec } from '../../modules/types'
import { actions, patchStore } from '../../patch/store'
import { SWITCH } from '../../modules/panelMetrics'
import { controlHover } from '../rack/controlHover'

interface Props {
  mod: string
  ps: ParamSpec
  value: number
  x: number
  y: number
  fg: string
}

/** Bat-handle toggle. Click steps through positions. options[0] is the down
 *  position (labelled below), the last is up (above), a third sits beside. */
export function Switch({ mod, ps, value, x, y, fg }: Props) {
  const steps = ps.max - ps.min + 1
  const pos = Math.round(value - ps.min)
  const up = steps === 1 ? 0 : pos / (steps - 1)
  const tip = 3.6 - up * 7.2
  const opts = ps.options ?? []
  const hover = (e: PointerEvent) => {
    const read = () => patchStore.get().modules.find((m) => m.id === mod)?.params[ps.id] ?? value
    const how = opts.length ? `Click to switch (${opts.filter(Boolean).join(' / ')})` : 'Click to switch'
    controlHover.set({ mod, ps, read, how, x: e.clientX, y: e.clientY })
  }
  return (
    <g
      className="switch"
      transform={`translate(${x} ${y})`}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={hover}
      onPointerMove={hover}
      onPointerLeave={() => controlHover.set(null)}
      onClick={(e) => {
        e.stopPropagation()
        actions.setParam(mod, ps.id, ps.min + ((pos + 1) % steps))
      }}
    >
      <rect x={-SWITCH.half} y={-SWITCH.halfH} width={SWITCH.half * 2} height={SWITCH.halfH * 2} fill="transparent" />
      {opts[steps - 1] && (
        <text className="silk" y={SWITCH.labelTop} fill={fg} fontSize={SWITCH.labelSize}>
          {opts[steps - 1]}
        </text>
      )}
      {steps === 3 && opts[1] && (
        <text className="silk" x={SWITCH.labelSide} y={0.7} fill={fg} fontSize={SWITCH.labelSize} style={{ textAnchor: 'start' }}>
          {opts[1]}
        </text>
      )}
      {opts[0] && (
        <text className="silk" y={SWITCH.labelBottom} fill={fg} fontSize={SWITCH.labelSize}>
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
