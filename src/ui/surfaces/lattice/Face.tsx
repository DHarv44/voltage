import { useMemo, useRef, type PointerEvent } from 'react'
import { telemetry } from '../../../audio/telemetry'
import { BOUNCE, cellId, DRAW, LT_COLORS, LT_LAYERS, LT_SIZE, LTL, SOLO } from '../../../modules/specs/lattice'
import { actions, patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { track } from '../../pointer'
import { drawCanvasKnob, useCanvasKnobs } from '../canvasKnob'
import { RES, sendSurface, useFrame, type SurfaceProps } from '../common'
import { Ripples } from './lights'
import { sideButtons, sideHint, sideKnobs } from './side'

const FAMILY = "Bahnschrift, 'Arial Narrow', sans-serif"
const OFF = '#1a2430'

/** LATTICE's face: the 16 × 16 lights, then the selected layer's settings.
 *  Click (or drag across) lights to draw on the selected layer; in BOUNCE a
 *  click sets that column's drop height; in SOLO the lights are played; in
 *  DRAW a held trace is recorded and looped. Every layer shows, the selected
 *  one brightest; notes ripple out across the grid. */
export function LatticeFace({ inst, spec, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const ripples = useRef(new Ripples())
  const byId = useMemo(() => new Map(spec.params.map((ps) => [ps.id, ps])), [spec])
  const live = () => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const set = (id: string, v: number) => actions.setParam(mod, id, v)

  // geometry, in canvas pixels
  const side = H * 0.96
  const g0 = H * 0.02
  const pitch = side / LT_SIZE
  const sx = g0 + side + H * 0.06
  const sw = W - sx - H * 0.02
  const panel = { sx, sw, W, H }

  const knobs = () => sideKnobs(mod, live(), panel, (id) => byId.get(id)!)
  const pressKnob = useCanvasKnobs(ref, mod, knobs)
  const buttons = () => sideButtons(mod, live(), panel)

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const t = now / 1000
    const p = live()
    const led = telemetry.leds[mod]
    const sel = Math.round(p.layer)
    ripples.current.update(p, led, t)
    ctx.fillStyle = '#c8ccd1'
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, H * 0.04)
    ctx.fill()
    ctx.fillStyle = '#0d131a'
    ctx.beginPath()
    ctx.roundRect(g0 * 0.5, g0 * 0.5, side + g0, side + g0, H * 0.03)
    ctx.fill()

    // the lights: every layer's dots, the selected one on top, then ripples
    const selCol = led?.[sel * LTL.block + LTL.col] ?? -1
    for (let cx = 0; cx < LT_SIZE; cx++)
      for (let cy = 0; cy < LT_SIZE; cy++) {
        const px = g0 + (cx + 0.5) * pitch
        const py = g0 + side - (cy + 0.5) * pitch
        let fill = cx === selCol ? '#2a3a4a' : OFF
        let alpha = 1
        for (let k = 0; k < LT_LAYERS; k++) {
          const l = (sel + 1 + k) % LT_LAYERS // selected layer drawn last
          if (((Math.round(p[cellId(l, cx)] ?? 0) >>> cy) & 1) === 0) continue
          fill = LT_COLORS[l]
          alpha = l === sel ? 1 : 0.35
        }
        ctx.globalAlpha = 1
        ctx.fillStyle = OFF
        ctx.beginPath()
        ctx.arc(px, py, pitch * 0.38, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = alpha
        ctx.fillStyle = fill
        ctx.fill()
        const r = ripples.current.at(cx, cy, t)
        if (r.v > 0.02) {
          // a halo in the layer's colour, then the lit lamp (no canvas shadow
          // blur: it's slow enough per cell to drag the whole page down)
          ctx.globalAlpha = r.v * 0.45
          ctx.fillStyle = r.color
          ctx.beginPath()
          ctx.arc(px, py, pitch * 0.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = r.v
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(px, py, pitch * 0.38, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    // BOUNCE balls on the selected layer
    if (Math.round(p[`mode${sel}`]) === BOUNCE)
      for (let cx = 0; cx < LT_SIZE; cx++) {
        const by = led?.[sel * LTL.block + LTL.balls + cx] ?? -1
        if (by < 0) continue
        ctx.globalAlpha = 1
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(g0 + (cx + 0.5) * pitch, g0 + side - (by + 0.5) * pitch, pitch * 0.24, 0, Math.PI * 2)
        ctx.fill()
      }
    ctx.globalAlpha = 1

    // the side: layers, mode and sound, knobs, transport
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const b of buttons()) {
      ctx.fillStyle = b.lit ? (b.color ?? '#22344c') : '#a9aeb5'
      ctx.beginPath()
      ctx.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.h * 0.25)
      ctx.fill()
      if (b.color && !b.lit) {
        ctx.fillStyle = b.color
        ctx.fillRect(b.x - b.w * 0.3, b.y + b.h * 0.28, b.w * 0.6, b.h * 0.1)
      }
      ctx.fillStyle = b.lit && !b.color ? '#e6ecf2' : '#14202c'
      ctx.font = `700 ${Math.round(Math.min(b.h * 0.42, b.w * 0.22))}px ${FAMILY}`
      ctx.fillText(b.label, b.x, b.y)
    }
    for (const k of knobs()) {
      drawCanvasKnob(ctx, k, W, H, { body: '#2b3440', pointer: LT_COLORS[sel], ticks: 'rgba(20,32,44,0.55)' })
      ctx.fillStyle = '#14202c'
      ctx.font = `600 ${Math.round(H * 0.04)}px ${FAMILY}`
      ctx.fillText(k.label ?? '', k.fx * W, H * 0.63)
    }
    const hint = sideHint(Math.round(p[`mode${sel}`]))
    if (hint) {
      ctx.fillStyle = '#22344c'
      ctx.font = `700 ${Math.round(H * 0.042)}px ${FAMILY}`
      ctx.fillText(hint, sx + sw / 2, H * 0.73)
    }
  })

  /** The light under a point (canvas px), or null. */
  const cellAt = (px: number, py: number): [number, number] | null => {
    const cx = Math.floor((px - g0) / pitch)
    const cy = Math.floor((g0 + side - py) / pitch)
    return cx >= 0 && cx < LT_SIZE && cy >= 0 && cy < LT_SIZE ? [cx, cy] : null
  }
  const local = (e: { clientX: number; clientY: number }, el: Element) => {
    const b = el.getBoundingClientRect()
    return [((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H]
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pressKnob(e)) return
    if (e.button !== 0) return
    const el = e.currentTarget
    const [px, py] = local(e, el)
    const hitBtn = buttons().find((b) => Math.abs(px - b.x) < b.w / 2 && Math.abs(py - b.y) < b.h / 2)
    if (hitBtn) {
      e.stopPropagation()
      e.preventDefault()
      hitBtn.press()
      return
    }
    const c = cellAt(px, py)
    if (!c) return
    e.stopPropagation()
    e.preventDefault()
    const l = Math.round(live().layer)
    const mask = (cx: number) => Math.round(live()[cellId(l, cx)] ?? 0)
    const mode = Math.round(live()[`mode${l}`])
    if (mode === SOLO || mode === DRAW) {
      // the hand goes to the engine: SOLO plays each light it enters, DRAW records the path
      const name = mode === SOLO ? 'solo' : 'draw'
      let at = c[0] * LT_SIZE + c[1]
      sendSurface(mod, name, l * LT_SIZE + c[0], c[1], true)
      track(
        (ev) => {
          const [mx, my] = local(ev, el)
          const n = cellAt(mx, my)
          const k = n ? n[0] * LT_SIZE + n[1] : -1
          if (k === at) return
          at = k
          sendSurface(mod, name, l * LT_SIZE + (n ? n[0] : 0), n ? n[1] : -1, true)
        },
        () => sendSurface(mod, name, l * LT_SIZE, 0, false),
      )
      return
    }
    if (mode === BOUNCE) {
      // one ball per column: the click sets its height (again: removes it)
      set(cellId(l, c[0]), mask(c[0]) === 1 << c[1] ? 0 : 1 << c[1])
      return
    }
    // draw: the first light decides whether the drag lights or clears
    const on = ((mask(c[0]) >>> c[1]) & 1) === 0
    const paint = ([cx, cy]: [number, number]) => {
      const m = mask(cx)
      const next = on ? m | (1 << cy) : m & ~(1 << cy)
      if (next !== m) set(cellId(l, cx), next)
    }
    paint(c)
    track(
      (ev) => {
        const [mx, my] = local(ev, el)
        const n = cellAt(mx, my)
        if (n) paint(n)
      },
      () => {},
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
      onPointerDown={down}
    />
  )
}
