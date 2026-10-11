import { packRows } from '../panelMetrics'
import { HP_MM, type Control, type ModuleSpec, type ParamSpec } from '../types'

/** Panel rows in shorthand, top to bottom: `k:id` knob (M), `ks:id` small
 *  knob, `kl:id` large knob, `s:id` switch, `i:id` input, `o:id` output,
 *  `b:name:LABEL` button, `l:index` LED, `-` an empty slot. */
export type Row = string[]

function control(tok: string): Control | null {
  const [kind, a, b] = tok.split(':')
  switch (kind) {
    case 'k':
      return { kind: 'knob', param: a, x: 0, y: 0, size: 'M' }
    case 'ks':
      return { kind: 'knob', param: a, x: 0, y: 0, size: 'S' }
    case 'kl':
      return { kind: 'knob', param: a, x: 0, y: 0, size: 'L' }
    case 's':
      return { kind: 'switch', param: a, x: 0, y: 0 }
    case 'i':
      return { kind: 'in', jack: a, x: 0, y: 0 }
    case 'o':
      return { kind: 'out', jack: a, x: 0, y: 0 }
    case 'b':
      return { kind: 'button', name: a, x: 0, y: 0, label: b }
    case 'l':
      return { kind: 'led', index: Number(a), x: 0, y: 0 }
    default:
      return null
  }
}

/** A module whose panel is rows packed from the bottom up (the simple kind:
 *  utilities, effects). Everything but the rows is the ModuleSpec itself. */
export function simpleSpec(s: Omit<ModuleSpec, 'controls'> & { rows: Row[]; grid?: boolean; top?: (top: number, w: number) => Control[] }): ModuleSpec {
  const { rows, grid, top, ...spec } = s
  const w = spec.hp * HP_MM
  const layout = packRows(
    rows.map((r) => r.map(control)),
    { params: spec.params, inputs: spec.inputs, outputs: spec.outputs },
    w,
    { gap: 1.6, grid },
  )
  return { ...spec, controls: [...(top ? top(layout.top, w) : []), ...layout.controls] }
}

export const opts = (id: string, label: string, options: string[], def = 0): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })
export const pct = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0, max: 1, def, unit: '%' })
