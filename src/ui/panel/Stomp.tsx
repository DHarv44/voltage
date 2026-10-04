import type { PanelStyle } from '../../modules/types'
import { actions } from '../../patch/store'

interface Props {
  mod: string
  param: string
  on: boolean
  x: number
  y: number
  panel: PanelStyle
}

/** Stompbox footswitch with its status LED. Click to stomp (toggles the pedal). */
export function Stomp({ mod, param, on, x, y, panel }: Props) {
  return (
    <g
      className="stomp"
      transform={`translate(${x} ${y})`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        actions.setParam(mod, param, on ? 0 : 1)
      }}
    >
      <title>{on ? 'On: click to bypass' : 'Bypassed: click to switch on'}</title>
      <g transform="translate(0 -13)" pointerEvents="none">
        <circle r={2.1} fill="#141414" />
        <circle r={1.6} fill={on ? panel.accent : '#3a2420'} style={on ? { filter: `drop-shadow(0 0 1.2px ${panel.accent})` } : undefined} />
      </g>
      <circle r={7.4} fill="#141414" opacity={0.35} />
      <circle r={6.6} fill="url(#jack-nut)" stroke="#55585c" strokeWidth={0.2} />
      <circle r={4.9} fill="url(#knob-cap)" stroke="#6b6e72" strokeWidth={0.2} />
      <circle r={3.3} fill="none" stroke="#9a9da1" strokeWidth={0.25} opacity={0.6} />
    </g>
  )
}
