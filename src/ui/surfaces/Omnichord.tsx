import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { OMNI_ROOTS, OMNI_TYPES, OMNI_ZONES, OML } from '../../modules/specs/omnichord'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

/** Fraction of the surface width taken by the chord buttons; the rest is the plate. */
const GRID = 0.76
const ROWS = OMNI_TYPES.length
const COLS = OMNI_ROOTS.length

/** Chord buttons (hold) and the strum plate (swipe up/down across it). */
export function Omnichord({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const pressed = useRef<{ c: number; r: number } | null>(null)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const root = led?.[OML.root] ?? 3
    const type = led?.[OML.type] ?? 0
    ctx.fillStyle = '#efe7d6'
    ctx.fillRect(0, 0, W, H)

    // Chord buttons.
    const gw = W * GRID
    const bw = gw / COLS
    const bh = H / (ROWS + 0.4)
    ctx.textAlign = 'center'
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const bx = c * bw + bw * 0.1
        const by = H * 0.06 + r * bh + bh * 0.08
        const on = c === root && r === type
        const down = pressed.current?.c === c && pressed.current?.r === r
        ctx.fillStyle = down ? '#c94f2e' : on ? '#e9895f' : ['#3a3633', '#5b534c', '#7a6f63'][r]
        ctx.beginPath()
        ctx.roundRect(bx, by, bw * 0.8, bh * 0.78, bh * 0.12)
        ctx.fill()
        ctx.fillStyle = on || down ? '#fff' : '#f2ebde'
        ctx.font = `600 ${Math.round(bh * 0.3)}px Bahnschrift, 'Arial Narrow', sans-serif`
        ctx.fillText(OMNI_ROOTS[c], bx + bw * 0.4, by + bh * 0.42)
        ctx.font = `${Math.round(bh * 0.18)}px Bahnschrift, 'Arial Narrow', sans-serif`
        ctx.fillText(OMNI_TYPES[r], bx + bw * 0.4, by + bh * 0.66)
      }

    // Strum plate: 13 strings; the struck one glows.
    const px = gw + W * 0.03
    const pw = W - px - W * 0.02
    ctx.fillStyle = '#d8cdb8'
    ctx.beginPath()
    ctx.roundRect(px, H * 0.04, pw, H * 0.92, 6)
    ctx.fill()
    const zone = led?.[OML.zone] ?? -1
    const flash = led?.[OML.flash] ?? 0
    for (let z = 0; z < OMNI_ZONES; z++) {
      const zy = H * 0.04 + H * 0.92 * (1 - (z + 0.5) / OMNI_ZONES)
      const lit = z === zone ? flash : 0
      ctx.fillStyle = lit > 0.02 ? `rgba(233,137,95,${0.35 + lit * 0.65})` : 'rgba(80,70,60,0.35)'
      ctx.fillRect(px + pw * 0.1, zy - 1.5, pw * 0.8, 3 + lit * 4)
    }
    ctx.fillStyle = 'rgba(60,50,40,0.55)'
    ctx.font = `${Math.round(H * 0.045)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillText('SONIC STRINGS', px + pw / 2, H * 0.995)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    if (fx < GRID) {
      const bh = 1 / (ROWS + 0.4)
      const fy = ((e.clientY - r.top) / r.height - 0.06) / bh
      const c = Math.min(COLS - 1, Math.max(0, Math.floor((fx / GRID) * COLS)))
      const row = Math.min(ROWS - 1, Math.max(0, Math.floor(fy)))
      pressed.current = { c, r: row }
      sendSurface(mod, 'chord', c, row, true)
      track(
        () => {},
        () => {
          pressed.current = null
          sendSurface(mod, 'chord', c, row, false)
        },
      )
      return
    }
    const pos = (cy: number) => 1 - ((cy - r.top) / r.height - 0.04) / 0.92
    sendSurface(mod, 'strum', pos(e.clientY), 0, true)
    track(
      (ev) => sendSurface(mod, 'strum', pos(ev.clientY), 0, true),
      () => sendSurface(mod, 'strum', 0, 0, false),
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
