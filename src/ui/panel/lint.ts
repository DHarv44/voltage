import { SPEC_LIST } from '../../modules'
import { HP_MM, PANEL_H_MM, type Control, type ModuleSpec } from '../../modules/types'
import { SCREW_Y_MM, screwHoles } from '../geometry'
import { footprint, jackLabelSize, MIN_LABEL_SIZE, PANEL, partsOverlap, textBox, textWidth, titleSize, type Box } from '../../modules/panelMetrics'

/** Panel linter: lays every module out (at every size it comes in) with the
 *  real control footprints from metrics and reports what collides: controls
 *  or labels on top of each other, over the title or the screws, off the
 *  panel, or labels too wide for their output plate. Runs on dev startup. */

/** Overlaps thinner than this (mm) are just touching. */
const SLACK = 0.25

const overlap = (a: Box, b: Box) => partsOverlap(a, b, SLACK)

/** Closer than ALIGN_MIN reads as aligned; further than ALIGN_MAX as deliberate. */
const ALIGN_MIN = 0.2
const ALIGN_MAX = 1.5

type PointControl = Extract<Control, { kind: 'knob' | 'in' | 'out' | 'switch' | 'button' | 'file' | 'stomp' }>
const isPoint = (c: Control): c is PointControl =>
  c.kind === 'knob' || c.kind === 'in' || c.kind === 'out' || c.kind === 'switch' || c.kind === 'button' || c.kind === 'file' || c.kind === 'stomp'
function name(c: PointControl): string {
  switch (c.kind) {
    case 'knob':
    case 'switch':
    case 'stomp':
      return `${c.kind} ${c.param}`
    case 'in':
    case 'out':
      return `${c.kind} ${c.jack}`
    case 'button':
      return `button ${c.name}`
    case 'file':
      return `file ${c.slot}`
  }
}

/** Lint one panel layout; returns human-readable problems. */
export function lintLayout(spec: ModuleSpec, controls: Control[], hp: number): string[] {
  const w = hp * HP_MM
  const at = spec.sizes ? `${spec.type}@${hp}HP` : spec.type
  const out: string[] = []
  const boxes = controls.flatMap((c, i) => footprint(c, spec, i))

  // the panel itself: edges, screws and the printed title
  for (const b of boxes) {
    if (b.x0 < -0.1 || b.x1 > w + 0.1 || b.y0 < -0.1 || b.y1 > PANEL_H_MM + 0.1) out.push(`${at}: ${b.what} runs off the panel`)
  }
  const screws: Box[] = screwHoles(hp).flatMap((x) =>
    [SCREW_Y_MM, PANEL_H_MM - SCREW_Y_MM].map((y) => ({
      x0: x - PANEL.screwR,
      y0: y - PANEL.screwR,
      x1: x + PANEL.screwR,
      y1: y + PANEL.screwR,
      part: 'body' as const,
      own: -1,
      what: 'a screw',
      r: PANEL.screwR,
    })),
  )
  const tSize = titleSize(hp, spec.title)
  const title = { ...textBox(spec.title, w / 2, PANEL.titleY, tSize * 1.12, -2, 'the title'), y1: 13.1 } // tracking + underline
  for (const b of boxes) {
    if (b.part === 'screen') continue // glass may cover the title on purpose
    if (screws.some((s) => overlap(s, b))) out.push(`${at}: ${b.what} covers a screw`)
    if (overlap(b, title)) out.push(`${at}: ${b.what} covers the title`)
  }
  if (textWidth(spec.title, tSize) * 1.12 > w - 2) out.push(`${at}: the title is wider than the panel`)

  // controls against each other (a control's own label may sit on its plate)
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      if (a.own === b.own || !overlap(a, b)) continue
      out.push(`${at}: ${a.what}${a.part === 'label' ? ' (label)' : ''} overlaps ${b.what}${b.part === 'label' ? ' (label)' : ''}`)
    }

  // near misses: controls almost (but not quite) in the same column or row
  const points = controls.filter(isPoint)
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]
      const b = points[j]
      const dx = Math.abs(a.x - b.x)
      const dy = Math.abs(a.y - b.y)
      if (dx > ALIGN_MIN && dx < ALIGN_MAX && dy < 45) out.push(`${at}: ${name(a)} and ${name(b)} are ${dx.toFixed(1)} mm out of column`)
      if (dy > ALIGN_MIN && dy < ALIGN_MAX && dx < 30) out.push(`${at}: ${name(a)} and ${name(b)} are ${dy.toFixed(1)} mm out of row`)
    }

  // output labels shrink to fit their plate, but not past readable
  for (const c of controls) {
    if (c.kind !== 'out') continue
    const text = c.label ?? spec.outputs.find((j) => j.id === c.jack)?.label ?? ''
    if (jackLabelSize(text, true) < MIN_LABEL_SIZE) out.push(`${at}: out ${c.jack} label "${text}" is too long for its plate`)
  }
  return [...new Set(out)]
}

/** Every module, at every size. */
export function lintPanels(): string[] {
  return SPEC_LIST.flatMap((spec) =>
    spec.sizes && spec.layout ? spec.sizes.flatMap((hp) => lintLayout(spec, spec.layout!(hp), hp)) : lintLayout(spec, spec.controls, spec.hp),
  )
}
