import { useMemo, useRef, type PointerEvent } from 'react'
import { telemetry } from '../../../audio/telemetry'
import { BOUNCE, cellId, layerParams, LT_COLORS, LT_LAYERS, LT_MODES, LT_SIZE, LT_SOUNDS, LTL } from '../../../modules/specs/lattice'
import { actions, patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { track } from '../../pointer'
import { drawCanvasKnob, useCanvasKnobs, type CanvasKnob } from '../canvasKnob'
import { RES, useFrame, type SurfaceProps } from '../common'
import { Ripples } from './lights'

const FAMILY = "Bahnschrift, 'Arial Narrow', sans-serif"
const OFF = '#1a2430'

interface Button {
  label: string
  x: number
  y: number
  w: number
  h: number
  color?: string
  lit?: boolean
  press: () => void
}

/** LATTICE's face: the 16 × 16 lights, then the selected layer's settings.
 *  Click (or drag across) lights to draw on the selected layer; in BOUNCE a
 *  click sets that column's drop height. Every layer shows, the selected one
 *  brightest; notes ripple out across the grid. */
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
  const fx = (px: number) => px / W
  const fy = (py: number) => py / H

  const knobs = (): CanvasKnob[] => {
    const p = live()
    const lp = layerParams(Math.round(p.layer))
    const ids = [lp.oct, lp.len, lp.rate, lp.vol]
    const names = ['OCTAVE', 'LOOP', 'RATE', 'VOLUME']
    return ids.map((id, i) => {
      const ps = byId.get(id)!
      return { fx: fx(sx + sw * (0.125 + i * 0.25)), fy: 0.6, fr: 0.07, ps, value: p[id] ?? ps.def, set: (v) => set(id, v), label: names[i] }
    })
  }
  const pressKnob = useCanvasKnobs(ref, knobs)

  const buttons = (): Button[] => {
    const p = live()
    const l = Math.round(p.layer)
    const lp = layerParams(l)
    const bw = sw / 4 - H * 0.02
    const col = (i: number) => sx + (sw / 4) * (i + 0.5)
    return [
      ...LT_COLORS.map((color, k) => ({ label: `${k + 1}`, x: col(k), y: H * 0.1, w: bw, h: H * 0.11, color, lit: l === k, press: () => set('layer', k) })),
      {
        label: LT_MODES[Math.round(p[lp.mode])],
        x: sx + sw * 0.25,
        y: H * 0.29,
        w: sw / 2 - H * 0.02,
        h: H * 0.11,
        press: () => set(lp.mode, (Math.round(p[lp.mode]) + 1) % LT_MODES.length),
      },
      {
        label: LT_SOUNDS[Math.round(p[lp.snd])],
        x: sx + sw * 0.75,
        y: H * 0.29,
        w: sw / 2 - H * 0.02,
        h: H * 0.11,
        press: () => set(lp.snd, (Math.round(p[lp.snd]) + 1) % LT_SOUNDS.length),
      },
      { label: p.run >= 0.5 ? '■ STOP' : '▶ PLAY', x: sx + sw * 0.25, y: H * 0.88, w: sw / 2 - H * 0.02, h: H * 0.13, lit: p.run >= 0.5, press: () => set('run', p.run >= 0.5 ? 0 : 1) },
      {
        label: 'CLEAR',
        x: sx + sw * 0.75,
        y: H * 0.88,
        w: sw / 2 - H * 0.02,
        h: H * 0.13,
        press: () => actions.setParams(Array.from({ length: LT_SIZE }, (_, c) => [mod, cellId(l, c), 0] as [string, string, number]), `clear:${mod}`),
      },
    ]
  }

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
      ctx.font = `600 ${Math.round(H * 0.045)}px ${FAMILY}`
      ctx.fillText(k.label ?? '', k.fx * W, H * 0.73)
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
    if (Math.round(live()[`mode${l}`]) === BOUNCE) {
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
