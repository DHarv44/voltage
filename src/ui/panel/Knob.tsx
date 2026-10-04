import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { KnobSize, ParamSpec } from '../../modules/types'
import { formatParam, fromNorm, toNorm } from '../../modules/params'
import { actions, patchStore } from '../../patch/store'
import { track } from '../pointer'

const RADIUS: Record<KnobSize, number> = { L: 6.2, M: 4.6, S: 3.3 }
const TICKS = Array.from({ length: 11 }, (_, i) => -135 + i * 27)

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

/** Wheel steps per full knob travel (Shift = fine). */
const WHEEL_STEPS = 50
const WHEEL_STEPS_FINE = 250

/** Pot. Scroll wheel: up = clockwise, down = anticlockwise. Left- or
 *  middle-button drag up/down also turns it (grab the panel elsewhere to move it).
 *  Shift = fine. Double-click = default. */
export function Knob({ mod, ps, value, x, y, size = 'M', label, fg }: Props) {
  const r = RADIUS[size]
  const [active, setActive] = useState(false)
  const gRef = useRef<SVGGElement>(null)
  const latest = useRef({ mod, ps, value })
  latest.current = { mod, ps, value }
  const n = toNorm(ps, value)
  const angle = -135 + 270 * n
  const text = label ?? ps.label

  // Native, non-passive wheel listener so the rack doesn't scroll under the knob.
  useEffect(() => {
    const el = gRef.current
    if (!el) return
    let hide: number | undefined
    let acc = 0 // fractional notches (smooth trackpads / high-res wheels)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const { mod, ps } = latest.current
      // Read the live value from the store: a fast spin can deliver several
      // notches before React re-renders, and each must build on the last.
      const value = patchStore.get().modules.find((m) => m.id === mod)?.params[ps.id] ?? latest.current.value
      acc += -e.deltaY / (e.deltaMode === 1 ? 3 : 100) // wheel up = clockwise
      let next: number
      if (ps.stepped) {
        // detented knobs move one position per whole notch
        const notches = Math.trunc(acc)
        if (!notches) return
        acc -= notches
        next = Math.min(ps.max, Math.max(ps.min, value + notches))
      } else {
        next = fromNorm(ps, toNorm(ps, value) + acc / (e.shiftKey ? WHEEL_STEPS_FINE : WHEEL_STEPS))
        acc = 0
      }
      if (next !== value) actions.setParam(mod, ps.id, next)
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

  const down = (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0 && e.button !== 1) return // right-click falls through to the panel menu
    e.stopPropagation()
    const d = { y: e.clientY, n, v: value }
    setActive(true)
    track(
      (ev) => {
        d.n = Math.min(1, Math.max(0, d.n + (d.y - ev.clientY) / (ev.shiftKey ? 1200 : 220)))
        d.y = ev.clientY
        const v = fromNorm(ps, d.n)
        if (v !== d.v) {
          d.v = v
          actions.setParam(mod, ps.id, v)
        }
      },
      () => setActive(false),
    )
  }

  const readout = formatParam(ps, value)
  return (
    <g
      ref={gRef}
      className="knob"
      transform={`translate(${x} ${y})`}
      onPointerDown={down}
      onDoubleClick={(e) => {
        e.stopPropagation()
        actions.setParam(mod, ps.id, ps.def)
      }}
    >
      <title>{`${ps.label}: ${readout}`}</title>
      {TICKS.map((a) => (
        <line
          key={a}
          x1={0}
          y1={-(r + 1.1)}
          x2={0}
          y2={-(r + (a === -135 || a === 135 || a === 0 ? 2.2 : 1.8))}
          stroke={fg}
          strokeWidth={0.28}
          transform={`rotate(${a})`}
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
        transform={`rotate(${angle})`}
      />
      {text && (
        <text className="silk" y={r + (size === 'L' ? 4.6 : 3.9)} fill={fg} fontSize={size === 'S' ? 1.9 : 2.3}>
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
