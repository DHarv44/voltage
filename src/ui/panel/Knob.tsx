import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { KnobSize, ParamSpec } from '../../modules/types'
import { formatParam } from '../../modules/params'
import { actions, patchStore } from '../../patch/store'
import { dragKnob, knobAngle, knobHow, knobTicks, turnsKnob, wheelTurner } from './knobModel'
import { KNOB } from '../../modules/panelMetrics'
import { controlHover } from '../rack/controlHover'

interface Props {
  mod: string
  ps: ParamSpec
  value: number
  x: number
  y: number
  size?: KnobSize
  label?: string
  fg: string
}

/** Pot. Behaviour (sweep, ticks, drag, wheel, reset, tooltip) comes from
 *  knobModel and its size from metrics, shared with knobs drawn on surfaces. */
export function Knob({ mod, ps, value, x, y, size = 'M', label, fg }: Props) {
  const r = KNOB.r[size]
  const [active, setActive] = useState(false)
  const gRef = useRef<SVGGElement>(null)
  const latest = useRef({ mod, ps, value })
  latest.current = { mod, ps, value }
  const text = label ?? ps.label

  // Native, non-passive wheel listener so the rack doesn't scroll under the knob.
  useEffect(() => {
    const el = gRef.current
    if (!el) return
    let hide: number | undefined
    const turn = wheelTurner()
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const { mod, ps } = latest.current
      // the live value: a fast spin delivers several notches before React re-renders
      const value = patchStore.get().modules.find((m) => m.id === mod)?.params[ps.id] ?? latest.current.value
      const next = turn(e, ps, value)
      if (next !== null) actions.setParam(mod, ps.id, next)
      controlHover.set(null) // the knob's own readout shows the value now
      setActive(true)
      window.clearTimeout(hide)
      hide = window.setTimeout(() => setActive(false), 700)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.clearTimeout(hide)
    }
  }, [])

  const hover = (e: PointerEvent<SVGGElement>) => {
    if (e.buttons) return // mid-drag: the knob's own readout is up
    const { mod, ps } = latest.current
    const read = () => patchStore.get().modules.find((m) => m.id === mod)?.params[ps.id] ?? latest.current.value
    controlHover.set({ mod, ps, label: text, read, how: knobHow(ps), x: e.clientX, y: e.clientY })
  }

  const down = (e: PointerEvent<SVGGElement>) => {
    if (!turnsKnob(e)) return
    e.stopPropagation()
    controlHover.set(null)
    setActive(true)
    dragKnob(e, ps, value, (v) => actions.setParam(mod, ps.id, v), () => setActive(false))
  }

  const readout = formatParam(ps, value)
  return (
    <g
      ref={gRef}
      className="knob"
      transform={`translate(${x} ${y})`}
      onPointerDown={down}
      onPointerEnter={hover}
      onPointerMove={hover}
      onPointerLeave={() => controlHover.set(null)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        actions.setParam(mod, ps.id, ps.def)
      }}
    >
      {knobTicks(ps).map((t) => (
        <line
          key={t.angle}
          x1={0}
          y1={-(r + KNOB.tickIn)}
          x2={0}
          y2={-(r + (t.major ? KNOB.tickMajor : KNOB.tickMinor))}
          stroke={fg}
          strokeWidth={t.major ? 0.32 : 0.26}
          transform={`rotate(${t.angle})`}
        />
      ))}
      {size === 'L' && <circle r={r + 0.7} fill="url(#knob-skirt)" />}
      <circle r={r} fill="url(#knob-body)" stroke="#000" strokeWidth={0.25} />
      <circle r={r * 0.62} fill="url(#knob-cap)" />
      <line
        x1={0}
        y1={-r * 0.2}
        x2={0}
        y2={-r + 0.45}
        stroke="#f4f1ea"
        strokeWidth={size === 'S' ? 0.55 : 0.7}
        strokeLinecap="round"
        transform={`rotate(${knobAngle(ps, value)})`}
      />
      {text && (
        <text className="silk" y={r + KNOB.labelGap(size)} fill={fg} fontSize={KNOB.labelSize(size)}>
          {text}
        </text>
      )}
      {active && (
        <g transform={`translate(0 ${-r - 4.2})`} pointerEvents="none">
          <rect x={-readout.length * 0.78 - 1.2} y={-2.6} width={readout.length * 1.56 + 2.4} height={4} rx={0.8} fill="#111" opacity={0.9} />
          <text className="readout" y={0.4} fill="#ffd25a" fontSize={2.5}>
            {readout}
          </text>
        </g>
      )}
    </g>
  )
}
