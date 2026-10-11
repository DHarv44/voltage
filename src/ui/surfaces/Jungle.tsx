import { useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { JG_EFFECTS, JG_SLICES, JG_STEPS, JGL } from '../../modules/specs/jungle'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { fitFont, RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const STRIP = 0.42
const MARKS = ['', '×2', '×4', '◀']

/** JUNGLE's screen: the break along the top as its 32 slices (how loud
 *  each is); below, the sixteen steps with the slice each plays and its
 *  effect. Click a step to select it, then a slice above to give it that
 *  slice; scroll on a step to step its slice; Shift-click a step for its
 *  next effect (rolls, reverse); right-click a step to rest it. */
export function Jungle({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const [sel, setSel] = useState(0)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const sh = H * STRIP
  const sw = W / JG_SLICES
  const cw = W / JG_STEPS

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const led = telemetry.leds[mod]
    const step = led?.[JGL.step] ?? -1
    const playing = step >= 0 ? Math.round(p[`s${step}`] ?? -1) : -1
    const chosen = Math.round(p[`s${sel}`] ?? -1)
    ctx.fillStyle = '#121214'
    ctx.fillRect(0, 0, W, H)
    // the break, slice by slice
    for (let k = 0; k < JG_SLICES; k++) {
      const pk = Math.min(1, (led?.[JGL.slice0 + k] ?? 0) * 1.2)
      const hh = Math.max(2, pk * (sh - 14))
      ctx.fillStyle = k === playing ? '#ffe08a' : k === chosen ? '#ff8a3d' : k % 4 === 0 ? '#5b8fa8' : '#3a5d6e'
      ctx.fillRect(k * sw + 1, sh / 2 - hh / 2, sw - 2, hh)
      if (k % 4 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.font = `${Math.round(sh * 0.14)}px ${FONT}`
        ctx.textAlign = 'left'
        ctx.fillText(`${k + 1}`, k * sw + 2, sh - 3)
      }
    }
    // the steps
    for (let i = 0; i < JG_STEPS; i++) {
      const s = Math.round(p[`s${i}`] ?? -1)
      const fx = Math.round(p[`x${i}`] ?? 0)
      const cx = i * cw
      ctx.fillStyle = i === step ? '#3d3420' : i === sel ? '#2c2f36' : i % 4 === 0 ? '#22252a' : '#1a1c20'
      ctx.fillRect(cx + 1.5, sh + 2, cw - 3, H - sh - 4)
      if (i === sel) {
        ctx.strokeStyle = '#ff8a3d'
        ctx.lineWidth = 1.5 * RES
        ctx.strokeRect(cx + 2, sh + 3, cw - 4, H - sh - 6)
      }
      ctx.textAlign = 'center'
      ctx.fillStyle = s < 0 ? '#4a4d55' : '#ece7da'
      const t = s < 0 ? '–' : `${s + 1}`
      fitFont(ctx, t, cw - 6, (H - sh) * 0.36, FONT, '700')
      ctx.fillText(t, cx + cw / 2, sh + (H - sh) * 0.5)
      if (fx > 0 && s >= 0) {
        ctx.fillStyle = '#ff8a3d'
        fitFont(ctx, MARKS[fx], cw - 6, (H - sh) * 0.24, FONT, '600')
        ctx.fillText(MARKS[fx], cx + cw / 2, sh + (H - sh) * 0.84)
      }
    }
  })

  const where = (e: { clientX: number; clientY: number }, r: DOMRect) => ({ fx: ((e.clientX - r.left) / r.width) * W, fy: ((e.clientY - r.top) / r.height) * H })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    if (fy < sh) {
      actions.setParam(mod, `s${sel}`, Math.min(JG_SLICES - 1, Math.floor(fx / sw)))
      return
    }
    const i = Math.min(JG_STEPS - 1, Math.floor(fx / cw))
    if (e.shiftKey) actions.setParam(mod, `x${i}`, (Math.round(live()[`x${i}`] ?? 0) + 1) % JG_EFFECTS.length)
    setSel(i)
  }

  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    if (fy >= sh) actions.setParam(mod, `s${Math.min(JG_STEPS - 1, Math.floor(fx / cw))}`, -1)
  }

  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    if (fy < sh) return
    e.stopPropagation()
    const i = Math.min(JG_STEPS - 1, Math.floor(fx / cw))
    const s = Math.round(live()[`s${i}`] ?? 0)
    actions.setParam(mod, `s${i}`, Math.max(-1, Math.min(JG_SLICES - 1, s + (e.deltaY < 0 ? 1 : -1))))
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onContextMenu={context} onWheel={wheel} />
}
