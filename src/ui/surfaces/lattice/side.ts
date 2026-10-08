import { cellId, DRAW, drawLenId, layerParams, LT_COLORS, LT_LAYERS, LT_MODES, LT_PAGES, LT_SIZE, LT_SOUNDS, pageIds, SOLO } from '../../../modules/specs/lattice'
import type { ParamSpec } from '../../../modules/types'
import { actions } from '../../../patch/store'
import type { CanvasKnob } from '../canvasKnob'

export interface Button {
  label: string
  x: number
  y: number
  w: number
  h: number
  color?: string
  lit?: boolean
  press: () => void
  /** Held (or right-clicked) instead of tapped. */
  hold?: () => void
}

/** The side of the face, in canvas pixels: from x `sx`, `sw` wide, `H` tall. */
export interface Side {
  sx: number
  sw: number
  W: number
  H: number
}

const ROWS = 2
const PER_ROW = LT_LAYERS / ROWS

/** The layer buttons (two rows of four), MODE and SOUND, pages A–D (a page
 *  picked while playing blinks till the bar ends; hold one to copy this page
 *  into it), PLAY and CLEAR. */
export function sideButtons(mod: string, p: Record<string, number>, s: Side, playing: number): Button[] {
  const { sx, sw, H } = s
  const set = (id: string, v: number) => actions.setParam(mod, id, v)
  const l = Math.round(p.layer)
  const pg = Math.round(p.page ?? 0)
  const lp = layerParams(l)
  const bw = sw / PER_ROW - H * 0.02
  const half = sw / 2 - H * 0.02
  const blink = Math.floor(performance.now() / 250) % 2 === 0
  const copy = (to: number) => {
    const from = pageIds(pg)
    const into = pageIds(to)
    if (to !== pg) actions.setParams(into.map((id, i) => [mod, id, p[from[i]] ?? 0] as [string, string, number]), `page:${mod}`)
  }
  return [
    ...LT_PAGES.map((label, k) => {
      const cued = p.run >= 0.5 && k === pg && k !== playing
      return {
        label,
        x: sx + (sw / LT_PAGES.length) * (k + 0.5),
        y: H * 0.765,
        w: sw / LT_PAGES.length - H * 0.02,
        h: H * 0.085,
        color: '#e6ecf2',
        lit: k === pg && (!cued || blink),
        press: () => set('page', k),
        hold: () => copy(k),
      }
    }),
    ...LT_COLORS.map((color, k) => ({
      label: `${k + 1}`,
      x: sx + (sw / PER_ROW) * ((k % PER_ROW) + 0.5),
      y: H * (0.065 + 0.11 * Math.floor(k / PER_ROW)),
      w: bw,
      h: H * 0.095,
      color,
      lit: l === k,
      press: () => set('layer', k),
    })),
    { label: LT_MODES[Math.round(p[lp.mode])], x: sx + sw * 0.25, y: H * 0.3, w: half, h: H * 0.1, press: () => set(lp.mode, (Math.round(p[lp.mode]) + 1) % LT_MODES.length) },
    { label: LT_SOUNDS[Math.round(p[lp.snd])], x: sx + sw * 0.75, y: H * 0.3, w: half, h: H * 0.1, press: () => set(lp.snd, (Math.round(p[lp.snd]) + 1) % LT_SOUNDS.length) },
    { label: p.run >= 0.5 ? '■ STOP' : '▶ PLAY', x: sx + sw * 0.25, y: H * 0.9, w: half, h: H * 0.1, lit: p.run >= 0.5, press: () => set('run', p.run >= 0.5 ? 0 : 1) },
    {
      label: 'CLEAR',
      x: sx + sw * 0.75,
      y: H * 0.9,
      w: half,
      h: H * 0.1,
      // this layer's lights on this page, and on DRAW the trace with them
      press: () =>
        actions.setParams(
          [...Array.from({ length: LT_SIZE }, (_, c) => [mod, cellId(l, c, pg), 0] as [string, string, number]), [mod, drawLenId(l, pg), 0]],
          `clear:${mod}`,
        ),
    },
  ]
}

/** The selected layer's five knobs. */
export function sideKnobs(mod: string, p: Record<string, number>, s: Side, spec: (id: string) => ParamSpec): CanvasKnob[] {
  const lp = layerParams(Math.round(p.layer))
  const ids = [lp.oct, lp.len, lp.rate, lp.vol, lp.swing]
  const names = ['OCTAVE', 'LOOP', 'RATE', 'VOLUME', 'SWING']
  return ids.map((id, i) => {
    const ps = spec(id)
    return {
      fx: (s.sx + s.sw * (0.1 + i * 0.2)) / s.W,
      fy: 0.52,
      fr: 0.062,
      ps,
      value: p[id] ?? ps.def,
      set: (v: number) => actions.setParam(mod, id, v),
      label: names[i],
    }
  })
}

/** What the hand does on the selected layer's lights, as a line under the knobs. */
export function sideHint(mode: number): string {
  if (mode === SOLO) return 'PRESS THE LIGHTS TO PLAY'
  if (mode === DRAW) return 'HOLD AND TRACE: IT LOOPS'
  return ''
}
