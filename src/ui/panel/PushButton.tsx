import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { engine } from '../../audio/engine'
import { telemetry } from '../../audio/telemetry'
import type { PanelStyle } from '../../modules/types'
import { track } from '../pointer'
import { BUTTON } from '../../modules/panelMetrics'

interface Props {
  mod: string
  name: string
  x: number
  y: number
  label: string
  led?: number
  ledColor?: string
  panel: PanelStyle
}

/** Momentary rubber push button (sends press/release to the module), with an
 *  optional status LED above it. */
export function PushButton({ mod, name, x, y, label, led, ledColor = '#ff3b2f', panel }: Props) {
  const lamp = useRef<SVGCircleElement>(null)
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    if (led === undefined) return
    return telemetry.subscribe(() => {
      const v = telemetry.leds[mod]?.[led] ?? 0
      if (lamp.current) lamp.current.style.opacity = String(Math.min(1, v))
    })
  }, [mod, led])

  const down = (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    engine.ui(mod, { kind: 'button', name, down: true })
    setPressed(true)
    track(
      () => {},
      () => {
        engine.ui(mod, { kind: 'button', name, down: false })
        setPressed(false)
      },
    )
  }

  return (
    <g className="pushbutton" transform={`translate(${x} ${y})`} onPointerDown={down}>
      <title>{`${label}: press (held while you hold it)`}</title>
      {led !== undefined && (
        <g transform={`translate(0 ${BUTTON.ledY})`} pointerEvents="none">
          <circle r={BUTTON.ledR} fill="#141414" />
          <circle ref={lamp} r={BUTTON.ledR - 0.35} fill={ledColor} style={{ opacity: 0, filter: `drop-shadow(0 0 0.8px ${ledColor})` }} />
        </g>
      )}
      <circle r={BUTTON.r} fill="url(#jack-nut)" stroke="#5a5d61" strokeWidth={0.15} />
      <circle r={3} fill={pressed ? '#2a2a2a' : '#3c3c3c'} stroke="#000" strokeWidth={0.2} />
      <circle r={2.2} cy={pressed ? 0.15 : -0.15} fill="url(#knob-cap)" opacity={pressed ? 0.6 : 1} />
      <text className="silk" y={BUTTON.labelY} fill={panel.fg} fontSize={BUTTON.labelSize}>
        {label}
      </text>
    </g>
  )
}
