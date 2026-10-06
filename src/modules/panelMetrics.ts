import type { Control, KnobSize, ModuleSpec } from './types'

/** The one place panel geometry lives (millimetres, like the panel drawings).
 *  The SVG controls draw from these numbers, specs lay panels out with them
 *  (packRows), and the panel linter checks layouts against them, so a change
 *  here moves all three: they can't disagree. DOM-free. */

/** Silk-screen text: SVG baseline at y; cap height and descender as fractions
 *  of the font size; average glyph advance (600 weight, 0.05 em tracking). */
export const SILK = { ascent: 0.74, descent: 0.22, advance: 0.66 }
export const textWidth = (s: string, size: number) => s.length * size * SILK.advance

/** The largest size (up to `size`) at which `text` fits in `maxW` mm. */
export const fitText = (text: string, maxW: number, size: number) => Math.min(size, maxW / Math.max(1, text.length * SILK.advance))

/** Below this a label is unreadable at normal zoom: shorten it instead. */
export const MIN_LABEL_SIZE = 1.5

export const KNOB = {
  r: { L: 6.2, M: 4.6, S: 3.3 } as Record<KnobSize, number>,
  /** Tick marks run from r + tickIn out to r + tickMinor (or r + tickMajor at
   *  the ends and centre). */
  tickIn: 1.1,
  tickMinor: 1.8,
  tickMajor: 2.2,
  /** Centre → label baseline (below the knob), and the label's size. */
  labelGap: (s: KnobSize) => (s === 'L' ? 4.6 : 3.9),
  labelSize: (s: KnobSize) => (s === 'S' ? 1.9 : 2.3),
}

export const JACK = {
  /** Hex nut half-width. */
  nut: 3.4,
  labelY: -5.4,
  labelSize: 2.2,
  /** Outputs sit on an inverted plate; it reaches up to hold the label. */
  plate: { half: 4.7, topLabelled: -9.9, top: -4.7, bottom: 4.7 },
}

/** A jack label's size: an output's label shrinks to fit on its plate. */
export const jackLabelSize = (text: string, out: boolean) =>
  out ? fitText(text, JACK.plate.half * 2 - 0.8, JACK.labelSize) : JACK.labelSize

export const SWITCH = { half: 3.2, halfH: 5, labelTop: -6.3, labelBottom: 8.2, labelSide: 3.6, labelSize: 2 }
export const LED = { r: 1.75 }
export const BUTTON = { r: 3.9, labelY: 7.2, labelSize: 2, ledY: -6.2, ledR: 1.5 }
export const STOMP = { r: 7.4, ledY: -13, ledR: 2.1 }
export const PAD = { rim: 0.5 }
export const PLATE = { labelGap: 3.4, labelSize: 2 }
/** Screens (scope, VISION, XY, surfaces) get a 1 mm bezel. */
export const BEZEL = 1

/** Panel furniture: the title, the maker's mark and the rail screws. */
export const PANEL = { titleY: 11, titleSize: 4.4, titleSizeNarrow: 3.4, makerYFromBottom: 7.4, makerSize: 1.8, screwR: 1.55 }

/** What a control covers. `body` parts are the control itself, `label` its
 *  silk-screen text, `screen` a display. `own` ties the parts of one control
 *  together (a label may sit on its own plate). */
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
  part: 'body' | 'label' | 'screen'
  own: number
  what: string
  /** Round parts (knobs, nuts, LEDs, buttons): their radius, for exact tests. */
  r?: number
}

const box = (cx: number, cy: number, hw: number, hh: number, part: Box['part'], own: number, what: string): Box => ({
  x0: cx - hw,
  y0: cy - hh,
  x1: cx + hw,
  y1: cy + hh,
  part,
  own,
  what,
})

/** A round part: its bounding box, remembered as a circle. */
const disc = (cx: number, cy: number, r: number, own: number, what: string): Box => ({ ...box(cx, cy, r, r, 'body', own, what), r })

/** Do two parts overlap by more than `slack` mm? Circles are tested as circles. */
export function partsOverlap(a: Box, b: Box, slack: number): boolean {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  if (ox <= slack || oy <= slack) return false
  const ca = a.r !== undefined
  const cb = b.r !== undefined
  if (!ca && !cb) return true
  if (ca && cb) {
    const d = Math.hypot((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2, (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2)
    return d < a.r! + b.r! - slack
  }
  // circle against rectangle: distance from the centre to the nearest point
  const [c, rect] = ca ? [a, b] : [b, a]
  const cx = (c.x0 + c.x1) / 2
  const cy = (c.y0 + c.y1) / 2
  const nx = Math.max(rect.x0, Math.min(cx, rect.x1))
  const ny = Math.max(rect.y0, Math.min(cy, rect.y1))
  return Math.hypot(cx - nx, cy - ny) < c.r! - slack
}

/** A line of silk text with its baseline at (cx, y), centred. */
export function textBox(text: string, cx: number, y: number, size: number, own: number, what: string, anchor: 'middle' | 'start' = 'middle'): Box {
  const w = textWidth(text, size)
  const x0 = anchor === 'middle' ? cx - w / 2 : cx
  return { x0, y0: y - size * SILK.ascent, x1: x0 + w, y1: y + size * SILK.descent, part: 'label', own, what: `label "${text}"` }
}

/** The printed title's size: smaller on narrow panels. */
export const titleSize = (hp: number, title: string) =>
  hp <= 4 ? PANEL.titleSizeNarrow : hp <= 12 && title.length > 8 ? 3.6 : PANEL.titleSize

/** Is the maker's mark (bottom centre) clear of every control? If something
 *  sits on it, the panel simply doesn't print it there. */
export function makerClear(spec: SpecLabels, controls: Control[], w: number): boolean {
  const mark = textBox('VOLTAGE', w / 2, PANEL_H - PANEL.makerYFromBottom, PANEL.makerSize, -3, 'maker')
  return !controls.some((c, i) => footprint(c, spec, i).some((b) => partsOverlap(b, mark, 0)))
}
const PANEL_H = 128.5

/** The lowest a control may reach: clear of the bottom rail screws. */
export const BOTTOM_CLEAR = 123.3

/** `n` evenly spaced centres on a panel `w` mm wide, at most `maxPitch` apart
 *  and at least 6 mm in from each edge (one alone sits in the middle). */
export function spread(w: number, n: number, maxPitch: number): number[] {
  if (n <= 1) return [w / 2]
  const s = Math.min(maxPitch, (w - 12) / (n - 1))
  return Array.from({ length: n }, (_, i) => w / 2 + (i - (n - 1) / 2) * s)
}

/** Lay controls out in rows from the bottom of the panel up, the rows stacked
 *  as tightly as their real footprints allow (knob rings, labels and output
 *  plates never touch). Each row is spread evenly across the width, or with
 *  `grid`, every row shares one set of columns (`null` leaves a column empty)
 *  so things line up down the panel. Returns the placed controls and the top
 *  of the highest row, so a screen or surface can take everything above. */
export function packRows(
  rows: (Control | null)[][],
  spec: SpecLabels,
  w: number,
  opts: { bottom?: number; gap?: number; maxPitch?: number; grid?: boolean } = {},
): { controls: Control[]; top: number } {
  const gap = opts.gap ?? 0.8
  const pitch = opts.maxPitch ?? 16
  const gridX = opts.grid ? spread(w, Math.max(...rows.map((r) => r.length)), pitch) : null
  let limit = opts.bottom ?? BOTTOM_CLEAR
  let top = limit
  const placed: Control[] = []
  for (let r = rows.length - 1; r >= 0; r--) {
    const xs = gridX ?? spread(w, rows[r].length, pitch)
    const row = rows[r].flatMap((c, i) => (c ? [{ ...c, x: xs[i], y: 0 } as Control] : []))
    let up = 0
    let down = 0
    for (const c of row)
      for (const b of footprint(c, spec, 0)) {
        up = Math.max(up, -b.y0)
        down = Math.max(down, b.y1)
      }
    const y = limit - down
    for (const c of row) placed.push({ ...c, y } as Control)
    top = y - up
    limit = top - gap
  }
  return { controls: placed, top }
}

/** What footprint needs from a spec: names for labels. */
export type SpecLabels = Pick<ModuleSpec, 'params' | 'inputs' | 'outputs'>

/** Every box a control covers, for the linter and layout helpers. */
export function footprint(c: Control, spec: SpecLabels, own: number): Box[] {
  switch (c.kind) {
    case 'knob': {
      const size = c.size ?? 'M'
      const r = KNOB.r[size]
      const ps = spec.params.find((p) => p.id === c.param)
      const text = c.label ?? ps?.label ?? ''
      const out = [disc(c.x, c.y, r + KNOB.tickMajor, own, `knob ${c.param}`)]
      if (text) out.push(textBox(text, c.x, c.y + r + KNOB.labelGap(size), KNOB.labelSize(size), own, `knob ${c.param}`))
      return out
    }
    case 'in':
    case 'out': {
      const js = (c.kind === 'in' ? spec.inputs : spec.outputs).find((j) => j.id === c.jack)
      const text = c.label ?? js?.label ?? ''
      const what = `${c.kind} ${c.jack}`
      const out =
        c.kind === 'out'
          ? [{ x0: c.x - JACK.plate.half, y0: c.y + (text ? JACK.plate.topLabelled : JACK.plate.top), x1: c.x + JACK.plate.half, y1: c.y + JACK.plate.bottom, part: 'body' as const, own, what }]
          : [disc(c.x, c.y, JACK.nut, own, what)]
      if (text) out.push(textBox(text, c.x, c.y + JACK.labelY, jackLabelSize(text, c.kind === 'out'), own, what))
      return out
    }
    case 'switch': {
      const ps = spec.params.find((p) => p.id === c.param)
      const opts = ps?.options ?? []
      const steps = ps ? ps.max - ps.min + 1 : 2
      const out = [box(c.x, c.y, SWITCH.half, SWITCH.halfH, 'body', own, `switch ${c.param}`)]
      if (opts[steps - 1]) out.push(textBox(opts[steps - 1], c.x, c.y + SWITCH.labelTop, SWITCH.labelSize, own, `switch ${c.param}`))
      if (steps === 3 && opts[1]) out.push(textBox(opts[1], c.x + SWITCH.labelSide, c.y + 0.7, SWITCH.labelSize, own, `switch ${c.param}`, 'start'))
      if (opts[0]) out.push(textBox(opts[0], c.x, c.y + SWITCH.labelBottom, SWITCH.labelSize, own, `switch ${c.param}`))
      return out
    }
    case 'led':
      return [disc(c.x, c.y, LED.r, own, 'led')]
    case 'text':
      return [textBox(c.text, c.x, c.y, c.size ?? 2.2, own, 'text')]
    case 'scope':
    case 'vision':
    case 'xypad':
    case 'surface':
      return [{ x0: c.x - BEZEL, y0: c.y - BEZEL, x1: c.x + c.w + BEZEL, y1: c.y + c.h + BEZEL, part: 'screen', own, what: c.kind === 'surface' ? `surface ${c.name}` : c.kind }]
    case 'pad': {
      const h = c.size / 2 + PAD.rim
      return [box(c.x, c.y, h, h, 'body', own, `pad ${c.index}`)]
    }
    case 'button':
    case 'file': {
      const what = c.kind === 'button' ? `button ${c.name}` : `file ${c.slot}`
      const out = [disc(c.x, c.y, BUTTON.r, own, what)]
      out.push(textBox(c.label, c.x, c.y + BUTTON.labelY, BUTTON.labelSize, own, what))
      if (c.kind === 'button' && c.led !== undefined) out.push(disc(c.x, c.y + BUTTON.ledY, BUTTON.ledR, own, what))
      return out
    }
    case 'plate': {
      const out: Box[] = [{ x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h, part: 'body', own, what: `plate ${c.index}` }]
      if (c.label) out.push(textBox(c.label, c.x + c.w / 2, c.y + c.h + PLATE.labelGap, PLATE.labelSize, own, `plate ${c.index}`))
      return out
    }
    case 'stomp':
      return [disc(c.x, c.y, STOMP.r, own, 'footswitch'), disc(c.x, c.y + STOMP.ledY, STOMP.ledR, own, 'footswitch')]
    case 'progress':
      return [{ x0: c.x, y0: c.y - 0.9, x1: c.x + c.w, y1: c.y + 0.9, part: 'body', own, what: 'progress' }]
    case 'steps': {
      const labelW = Math.max(...c.rows.map((r) => textWidth(r.label, 1.9)))
      return [
        {
          x0: c.x - c.dx * 1.05 - labelW / 2,
          // the pattern letter sits above the first row; without one, just the playhead
          y0: c.pattern ? c.y - c.dy * 0.85 - 1.9 * SILK.ascent : c.y - c.dy / 2 - 0.5,
          x1: c.x + (c.cols - 1) * c.dx + c.dx * 0.38,
          y1: c.y + (c.rows.length - 1) * c.dy + c.dy * 0.35,
          part: 'body',
          own,
          what: 'step grid',
        },
      ]
    }
    case 'section':
      return [] // a printed outline: things are meant to sit inside it
  }
}
