import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import type { PanelStyle, StepsControl } from '../../modules/types'
import { actions, patchStore } from '../../patch/store'
import { track } from '../pointer'

/** TR-808 step-button colours, one per beat of four. */
const QUARTER = ['#e8432b', '#f08a24', '#f2c53d', '#efe9dc']

interface Props {
  mod: string
  c: StepsControl
  params: Record<string, number>
  panel: PanelStyle
}

/** TR-style step grid. Click a step to toggle it; click-drag to paint a run.
 *  Edits go to the selected pattern (or the playing one in chain mode).
 *  The playhead column is painted from telemetry without re-rendering. */
export function StepGrid({ mod, c, params, panel }: Props) {
  const head = useRef<SVGRectElement>(null)
  const [playing, setPlaying] = useState(0)
  const paint = useRef<boolean | null>(null)

  useEffect(
    () =>
      telemetry.subscribe(() => {
        const leds = telemetry.leds[mod]
        const step = Math.round(leds?.[c.stepLed] ?? -1)
        const el = head.current
        if (el) {
          el.setAttribute('visibility', step < 0 ? 'hidden' : 'visible')
          if (step >= 0) el.setAttribute('x', String(c.x + step * c.dx - c.dx / 2))
        }
        if (c.patternLed !== undefined) {
          const pp = Math.round(leds?.[c.patternLed] ?? 0)
          setPlaying((prev) => (prev === pp ? prev : pp))
        }
      }),
    [mod, c],
  )

  const sel = c.pattern ? Math.round(params[c.pattern] ?? 0) : 0
  const mapped = c.patternMap ? (c.patternMap[sel] ?? 0) : sel
  const edit = mapped >= 0 ? mapped : playing // chains edit whatever is playing
  const len = c.length ? Math.round(params[c.length] ?? c.cols) : c.cols
  const bw = c.dx * 0.76
  const bh = c.dy * 0.7

  const setStep = (param: string, step: number, on: boolean) => {
    const m = patchStore.get().modules.find((x) => x.id === mod)
    const mask = m?.params[param] ?? 0
    const next = on ? mask | (1 << step) : mask & ~(1 << step)
    if (next !== mask) actions.setParam(mod, param, next)
  }

  const down = (param: string, step: number, isOn: boolean) => (e: PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    paint.current = !isOn
    setStep(param, step, !isOn)
    track(
      () => {},
      () => {
        paint.current = null
      },
    )
  }
  const enter = (param: string, step: number) => () => {
    if (paint.current !== null) setStep(param, step, paint.current)
  }

  return (
    <g className="stepgrid">
      <rect
        ref={head}
        x={c.x - c.dx / 2}
        y={c.y - c.dy / 2 - 0.5}
        width={c.dx}
        height={c.rows.length * c.dy + 1}
        rx={0.6}
        fill={panel.accent}
        opacity={0.22}
        visibility="hidden"
        pointerEvents="none"
      />
      {c.pattern && (
        <text className="silk" x={c.x - c.dx * 1.05} y={c.y - c.dy * 0.85} fill={panel.accent} fontSize={1.9}>
          {'ABCD'[edit] ?? '?'}
        </text>
      )}
      {c.rows.map((row, r) => {
        const param = row.p[edit] ?? row.p[0]
        const mask = params[param] ?? 0
        const y = c.y + r * c.dy
        return (
          <g key={r}>
            <text className="silk" x={c.x - c.dx * 1.05} y={y + 0.7} fill={panel.fg} fontSize={1.9}>
              {row.label}
            </text>
            {Array.from({ length: c.cols }, (_, s) => {
              const on = ((mask >>> s) & 1) === 1
              const color = QUARTER[Math.floor(s / 4) % 4]
              return (
                <rect
                  key={s}
                  className="step"
                  x={c.x + s * c.dx - bw / 2}
                  y={y - bh / 2}
                  width={bw}
                  height={bh}
                  rx={0.5}
                  fill={color}
                  fillOpacity={on ? 1 : 0.18}
                  stroke={on ? '#fff' : '#000'}
                  strokeOpacity={on ? 0.5 : 0.6}
                  strokeWidth={0.2}
                  opacity={s < len ? 1 : 0.35}
                  onPointerDown={down(param, s, on)}
                  onPointerEnter={enter(param, s)}
                />
              )
            })}
          </g>
        )
      })}
    </g>
  )
}
