import { patPre, POCKET_CHAIN, POCKET_FX, POCKET_PATTERNS, SONGL } from '../../modules/specs/pocketShared'
import type { ModuleSpec } from '../../modules/types'
import { actions, patchStore } from '../../patch/store'
import { track } from '../pointer'
import { sendSurface } from './common'

/** What the POCKETs' 16 buttons are showing: the steps (or keys), the
 *  patterns and chain, or the punch-in effects. */
export type Page = 'steps' | 'pat' | 'fx'

/** Kept across frames while you use the PATTERN page. */
export interface PageState {
  page: Page
  /** COPY pressed: the next pattern tapped gets a copy of this one. */
  copying: boolean
  /** CHAIN pressed: the patterns tapped so far (null when not writing one). */
  chain: number[] | null
}

/** The four function buttons, right of the knobs (fractions of the face). */
const FN = [
  { x: 0.62, y: 0.355, name: 'PLAY', id: 'run' },
  { x: 0.84, y: 0.355, name: 'WRITE', id: 'write' },
  { x: 0.62, y: 0.445, name: 'PATTERN', id: 'pat' },
  { x: 0.84, y: 0.445, name: 'FX', id: 'fx' },
] as const
const FN_W = 0.19
const FN_H = 0.075
/** PATTERN page: A–D, then these four, then the chain's eight slots. */
const COPY = 4
const CLEAR = 5
const CHAIN = 6
const SONG = 7
const PAT_KEYS = ['COPY', 'CLEAR', 'CHAIN', 'SONG']

const live = (mod: string): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? {}

/** The id prefix of the pattern being edited ('' for A). */
export const editPre = (p: Record<string, number>): string => patPre(Math.round(p.pat ?? 0))

/** The LCD's tag: the pattern being edited, or the song and what it's on. */
type Leds = ArrayLike<number> | undefined

export function songTag(p: Record<string, number>, led: Leds, base: number): string {
  if ((p.chon ?? 0) >= 0.5) return `SONG ${POCKET_PATTERNS[led?.[base + SONGL.pat] ?? 0] ?? 'A'}`
  return `PAT ${POCKET_PATTERNS[Math.round(p.pat ?? 0)]}`
}

export function drawFn(ctx: CanvasRenderingContext2D, W: number, H: number, p: Record<string, number>, page: Page, accent: string): void {
  for (const f of FN) {
    const on = f.id === 'run' ? p.run >= 0.5 : f.id === 'write' ? page === 'steps' && p.write >= 0.5 : page === f.id
    ctx.fillStyle = on ? accent : '#4a4540'
    ctx.beginPath()
    ctx.roundRect((f.x - FN_W / 2) * W, (f.y - FN_H / 2) * H, FN_W * W, FN_H * H, 6)
    ctx.fill()
    ctx.fillStyle = '#f2eee6'
    ctx.textAlign = 'center'
    ctx.font = `600 ${Math.round(H * 0.03)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillText(f.name, f.x * W, f.y * H + H * 0.011)
  }
}

/** Which function button is at (fx, fy), if any. */
export const fnAt = (fx: number, fy: number): (typeof FN)[number]['id'] | null =>
  FN.find((f) => Math.abs(fx - f.x) < FN_W / 2 && Math.abs(fy - f.y) < FN_H / 2)?.id ?? null

/** A function button pressed: PLAY and WRITE switch (WRITE also goes back
 *  to the steps); PATTERN and FX open their page, or close it again. */
export function pressFn(mod: string, id: string, st: PageState): void {
  const p = live(mod)
  st.copying = false
  st.chain = null
  if (id === 'run') actions.setParam(mod, 'run', p.run >= 0.5 ? 0 : 1)
  else if (id === 'write') {
    if (st.page === 'steps') actions.setParam(mod, 'write', p.write >= 0.5 ? 0 : 1)
    st.page = 'steps'
  } else st.page = st.page === id ? 'steps' : (id as Page)
}

/** One of the 16 buttons on the PATTERN or FX page: its label and whether it's lit. */
function pageKey(i: number, p: Record<string, number>, led: Leds, base: number, st: PageState): { label: string; on: boolean; dim?: boolean } {
  if (st.page === 'fx') return { label: POCKET_FX[i], on: led?.[base + SONGL.fx] === i }
  if (i < 4) return { label: POCKET_PATTERNS[i], on: i === Math.round(p.pat ?? 0) }
  if (i < 8) return { label: PAT_KEYS[i - 4], on: i === COPY ? st.copying : i === CHAIN ? st.chain !== null : i === SONG && (p.chon ?? 0) >= 0.5 }
  const j = i - 8
  const len = st.chain ? st.chain.length : Math.round(p.chlen ?? 1)
  if (j >= len) return { label: '·', on: false, dim: true }
  const k = st.chain ? st.chain[j] : Math.round(p[`ch${j}`] ?? 0)
  return { label: POCKET_PATTERNS[k], on: !st.chain && (p.chon ?? 0) >= 0.5 && led?.[base + SONGL.slot] === j }
}

/** Draw the PATTERN or FX page over the 4×4 grid (in pixels). */
export function drawPage(
  ctx: CanvasRenderingContext2D,
  g: { x: number; y: number; w: number; h: number },
  p: Record<string, number>,
  led: Leds,
  base: number,
  accent: string,
  st: PageState,
): void {
  const bw = g.w / 4
  const bh = g.h / 4
  const playing = led?.[base + SONGL.pat] ?? -1
  for (let i = 0; i < 16; i++) {
    const bx = g.x + (i % 4) * bw
    const by = g.y + Math.floor(i / 4) * bh
    const k = pageKey(i, p, led, base, st)
    ctx.fillStyle = k.on ? (st.page === 'fx' ? accent : '#3a3632') : k.dim ? '#e2dccf' : '#efe9dc'
    ctx.beginPath()
    ctx.roundRect(bx + 4, by + 4, bw - 8, bh - 8, 6)
    ctx.fill()
    // the pattern playing (it may be waiting for the bar to switch)
    if (st.page === 'pat' && i < 4 && i === playing && (p.run ?? 0) >= 0.5) {
      ctx.strokeStyle = accent
      ctx.lineWidth = 3
      ctx.stroke()
    }
    ctx.fillStyle = k.on ? '#f2eee6' : '#3a3632'
    ctx.textAlign = 'center'
    const big = st.page === 'pat' && (i < 4 || i >= 8)
    ctx.font = `${big ? '' : '600 '}${Math.round(bh * (big ? 0.3 : 0.15))}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillText(k.label, bx + bw / 2, by + bh * (big ? 0.6 : 0.55))
  }
}

/** Pattern k's params (ids), from the spec's pattern B block. */
const patternIds = (spec: ModuleSpec, k: number): string[] =>
  spec.params.filter((ps) => ps.id.startsWith('B.')).map((ps) => `${patPre(k)}${ps.id.slice(2)}`)

function copyPattern(mod: string, spec: ModuleSpec, from: number, to: number): void {
  const p = live(mod)
  const ids = patternIds(spec, 0) // pattern A's ids, unprefixed
  actions.setParams(ids.map((id) => [mod, `${patPre(to)}${id}`, p[`${patPre(from)}${id}`] ?? 0]), `pocket-copy-${mod}`)
}

/** Clear a pattern: every step off and every lock gone (notes stay). */
function clearPattern(mod: string, spec: ModuleSpec, k: number): void {
  const pre = patPre(k)
  const ups: [string, string, number][] = []
  for (const ps of spec.params) {
    if (!ps.id.startsWith('B.')) continue
    const id = `${pre}${ps.id.slice(2)}`
    if (ps.min < 0) ups.push([mod, id, -1])
    else if (/^m\d*$/.test(ps.id.slice(2))) ups.push([mod, id, 0])
  }
  actions.setParams(ups, `pocket-clear-${mod}`)
}

/** Finish writing a chain: it becomes the song, and the song plays. */
function finishChain(mod: string, st: PageState): void {
  const c = st.chain ?? []
  st.chain = null
  if (!c.length) return
  actions.setParams([[mod, 'chlen', c.length], [mod, 'chon', 1], ...c.map((k, j): [string, string, number] => [mod, `ch${j}`, k])], `pocket-chain-${mod}`)
}

/** A button on the PATTERN or FX page pressed. */
export function pressPage(mod: string, spec: ModuleSpec, i: number, st: PageState): void {
  if (st.page === 'fx') {
    // held: the effect lasts as long as the button
    sendSurface(mod, 'fx', i, 0, true)
    track(
      () => {},
      () => sendSurface(mod, 'fx', i, 0, false),
    )
    return
  }
  const p = live(mod)
  if (i < 4) {
    if (st.chain) {
      st.chain.push(i)
      if (st.chain.length >= POCKET_CHAIN) finishChain(mod, st)
      return
    }
    if (st.copying) {
      st.copying = false
      copyPattern(mod, spec, Math.round(p.pat ?? 0), i)
    }
    actions.setParam(mod, 'pat', i)
  } else if (i === COPY) st.copying = !st.copying
  else if (i === CLEAR) clearPattern(mod, spec, Math.round(p.pat ?? 0))
  else if (i === CHAIN) {
    if (st.chain) finishChain(mod, st)
    else st.chain = []
  } else if (i === SONG) actions.setParam(mod, 'chon', (p.chon ?? 0) >= 0.5 ? 0 : 1)
}
