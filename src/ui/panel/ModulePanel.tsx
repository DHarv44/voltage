import { memo, type MouseEvent, type PointerEvent } from 'react'
import { SPECS } from '../../modules'
import { HP_MM, PANEL_H_MM, type Control, type ModuleSpec } from '../../modules/types'
import type { ModuleInst } from '../../patch/types'
import { PX, SCREW_Y_MM, moduleLeft, rowTop, screwHoles } from '../geometry'
import { Jack } from './Jack'
import { Knob } from './Knob'
import { Led } from './Led'
import { ScopeScreen } from './ScopeScreen'
import { Switch } from './Switch'
import { Pad } from './Pad'
import { PushButton } from './PushButton'
import { Progress } from './Progress'
import { StepGrid } from './StepGrid'
import { Plate } from './Plate'
import { FileButton } from './FileButton'
import { VisionScreen } from './VisionScreen'
import { XyPad } from './XyPad'
import { Stomp } from './Stomp'
import { SURFACES } from '../surfaces'
import type { SurfaceProps } from '../surfaces/common'

export interface PanelHandlers {
  jackDown(mod: string, jack: string, dir: 'in' | 'out', e: PointerEvent): void
  jackContext(mod: string, jack: string, dir: 'in' | 'out', e: MouseEvent): void
  /** Pointer over a jack (null = left it): drives the voltage readout. */
  jackHover(mod: string, jack: string, dir: 'in' | 'out', e: PointerEvent | null): void
  panelDown(mod: string, e: PointerEvent): void
  panelContext(mod: string, e: MouseEvent): void
}

interface Props {
  inst: ModuleInst
  row: number
  hp: number
  lifted: boolean
  handlers: PanelHandlers
}

export const ModulePanel = memo(function ModulePanel({ inst, row, hp, lifted, handlers }: Props) {
  const spec = SPECS[inst.type]
  const w = spec.hp * HP_MM
  return (
    <div
      className={lifted ? 'module lifted' : 'module'}
      style={{ left: moduleLeft(hp), top: rowTop(row), width: w * PX, height: PANEL_H_MM * PX }}
      onPointerDown={(e) => handlers.panelDown(inst.id, e)}
      onContextMenu={(e) => handlers.panelContext(inst.id, e)}
    >
      <svg viewBox={`0 0 ${w} ${PANEL_H_MM}`} width="100%" height="100%">
        <PanelFace spec={spec} w={w} />
        {spec.controls.map((c, i) => (
          <ControlView key={i} c={c} spec={spec} inst={inst} handlers={handlers} />
        ))}
      </svg>
      {spec.controls.map((c, i) =>
        c.kind === 'scope' ? (
          <ScopeScreen
            key={i}
            mod={inst.id}
            x={c.x}
            y={c.y}
            w={c.w}
            h={c.h}
            vdiv1={inst.params.g1}
            vdiv2={inst.params.g2}
            time={inst.params.time}
          />
        ) : c.kind === 'vision' ? (
          <VisionScreen key={i} mod={inst.id} x={c.x} y={c.y} w={c.w} h={c.h} scene={inst.params.scene} />
        ) : c.kind === 'xypad' ? (
          <XyPad
            key={i}
            mod={inst.id}
            x={c.x}
            y={c.y}
            w={c.w}
            h={c.h}
            scale={inst.params.scale}
            range={inst.params.range}
            morph={inst.params.morph === 1}
            corners={inst.morph}
          />
        ) : c.kind === 'surface' && SURFACES[c.name] ? (
          <SurfaceView key={i} name={c.name} inst={inst} spec={spec} x={c.x} y={c.y} w={c.w} h={c.h} />
        ) : null,
      )}
    </div>
  )
})

function SurfaceView({ name, ...props }: SurfaceProps & { name: string }) {
  const S = SURFACES[name]
  return <S {...props} />
}

function PanelFace({ spec, w }: { spec: ModuleSpec; w: number }) {
  const { bg, fg, accent } = spec.panel
  const screwX = screwHoles(spec.hp)
  return (
    <g pointerEvents="none">
      <rect x={0.15} y={0} width={w - 0.3} height={PANEL_H_MM} fill={bg} />
      <rect x={0.15} y={0} width={w - 0.3} height={PANEL_H_MM} fill="url(#panel-sheen)" />
      <rect x={0.15} y={0} width={w - 0.3} height={PANEL_H_MM} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={0.3} />
      {screwX.flatMap((x) => [SCREW_Y_MM, PANEL_H_MM - SCREW_Y_MM].map((y) => <Screw key={`${x}-${y}`} x={x} y={y} />))}
      <text className="silk title" x={w / 2} y={11} fill={fg} fontSize={spec.hp <= 4 ? 3.4 : 4.4}>
        {spec.title}
      </text>
      <rect x={w / 2 - Math.min(8, w / 3)} y={12.6} width={Math.min(16, (w * 2) / 3)} height={0.5} fill={accent} />
      <text className="silk maker" x={w / 2} y={PANEL_H_MM - 7.4} fill={fg} fontSize={1.8} opacity={0.75}>
        VOLTAGE
      </text>
    </g>
  )
}

function Screw({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={1.55} fill="url(#screw)" stroke="#555" strokeWidth={0.12} />
      <line x1={-1} y1={0} x2={1} y2={0} stroke="#555" strokeWidth={0.3} transform="rotate(35)" />
    </g>
  )
}

function ControlView({ c, spec, inst, handlers }: { c: Control; spec: ModuleSpec; inst: ModuleInst; handlers: PanelHandlers }) {
  const { fg } = spec.panel
  switch (c.kind) {
    case 'knob': {
      const ps = spec.params.find((p) => p.id === c.param)!
      return <Knob mod={inst.id} ps={ps} value={inst.params[c.param]} x={c.x} y={c.y} size={c.size} label={c.label} fg={fg} />
    }
    case 'switch': {
      const ps = spec.params.find((p) => p.id === c.param)!
      return <Switch mod={inst.id} ps={ps} value={inst.params[c.param]} x={c.x} y={c.y} fg={fg} />
    }
    case 'in':
    case 'out': {
      const js = (c.kind === 'in' ? spec.inputs : spec.outputs).find((j) => j.id === c.jack)!
      return (
        <Jack
          x={c.x}
          y={c.y}
          out={c.kind === 'out'}
          label={c.label ?? js.label}
          panel={spec.panel}
          onDown={(e) => handlers.jackDown(inst.id, c.jack, c.kind, e)}
          onContext={(e) => handlers.jackContext(inst.id, c.jack, c.kind, e)}
          onHover={(e) => handlers.jackHover(inst.id, c.jack, c.kind, e)}
        />
      )
    }
    case 'led':
      return <Led mod={inst.id} index={c.index} x={c.x} y={c.y} color={c.color} bipolar={c.bipolar} />
    case 'text':
      return (
        <text className="silk" x={c.x} y={c.y} fill={fg} fontSize={c.size ?? 2.2} pointerEvents="none">
          {c.text}
        </text>
      )
    case 'scope':
    case 'vision':
    case 'xypad':
    case 'surface':
      if (c.kind === 'surface' && c.bare) return null
      return <rect x={c.x - 1} y={c.y - 1} width={c.w + 2} height={c.h + 2} rx={1.5} fill="#0a0a0a" stroke="#444" strokeWidth={0.3} />
    case 'pad':
      return (
        <Pad mod={inst.id} index={c.index} x={c.x} y={c.y} size={c.size} label={c.label} sub={c.sub} led={c.led} panel={spec.panel} />
      )
    case 'button':
      return (
        <PushButton mod={inst.id} name={c.name} x={c.x} y={c.y} label={c.label} led={c.led} ledColor={c.ledColor} panel={spec.panel} />
      )
    case 'plate':
      return (
        <Plate mod={inst.id} index={c.index} x={c.x} y={c.y} w={c.w} h={c.h} label={c.label} led={c.led} panel={spec.panel} />
      )
    case 'stomp':
      return <Stomp mod={inst.id} param={c.param} on={inst.params[c.param] >= 0.5} x={c.x} y={c.y} panel={spec.panel} />
    case 'file':
      return <FileButton mod={inst.id} slot={c.slot} x={c.x} y={c.y} label={c.label} panel={spec.panel} />
    case 'progress':
      return <Progress mod={inst.id} x={c.x} y={c.y} w={c.w} led={c.led} panel={spec.panel} />
    case 'steps':
      return <StepGrid mod={inst.id} c={c} params={inst.params} panel={spec.panel} />
    case 'section':
      return (
        <g pointerEvents="none">
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={1.6} fill="none" stroke={fg} strokeOpacity={0.45} strokeWidth={0.3} />
          <text
            className="silk"
            x={c.x + c.w / 2}
            y={c.y + 0.9}
            fill={fg}
            fontSize={2.4}
            stroke={spec.panel.bg}
            strokeWidth={1.4}
            paintOrder="stroke"
          >
            {c.label}
          </text>
        </g>
      )
  }
}
