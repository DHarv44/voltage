import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { CL_LAUNCH, CL_SCENE, CL_SCENES, CL_STEPS, CL_STOP, CL_TIE, CL_TRACKS, CLL, clStep } from '../../modules/specs/clips'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { fitFont, RES, sendSurface, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const GRID = 0.4
const COLS = ['#ff7b54', '#ffd166', '#7fd6ff', '#a6f07a']
const ROWS = 25
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** CLIPS' screen. Left: the clips, a column per track, a row per scene
 *  (click to launch it and edit it; Shift-click to edit without launching);
 *  the ▶ beside a row launches the scene, the ■ under a column stops the
 *  track. Right: the clip being edited, sixteen steps over two octaves:
 *  click to place a note (again to clear it), right-click a step for a TIE. */
export function Clips({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const [sel, setSel] = useState({ t: 0, c: 0 })
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const gw = W * GRID
  const cw = gw / (CL_TRACKS + 1)
  const chh = H / (CL_SCENES + 1)
  const ex = gw + 4 * RES
  const sw = (W - ex) / CL_STEPS
  const rh = H / (ROWS + 1)

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const led = telemetry.leds[mod]
    const step = led?.[CLL.step] ?? -1
    ctx.fillStyle = '#111214'
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let t = 0; t < CL_TRACKS; t++) {
      const playing = led?.[CLL.playing + t] ?? Math.round(p[`pl${t}`])
      const cued = led?.[CLL.cued + t] ?? -2
      for (let c = 0; c < CL_SCENES; c++) {
        let has = false
        for (let s = 0; s < CL_STEPS && !has; s++) if (p[clStep(t, c, s)] >= 0) has = true
        const blink = cued === c && Math.floor(now / 250) % 2 === 0
        ctx.fillStyle = playing === c ? COLS[t] : has ? '#2c3036' : '#1a1c20'
        ctx.globalAlpha = blink ? 0.5 : 1
        ctx.fillRect(t * cw + 2, c * chh + 2, cw - 4, chh - 4)
        ctx.globalAlpha = 1
        if (sel.t === t && sel.c === c) {
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.5 * RES
          ctx.strokeRect(t * cw + 3, c * chh + 3, cw - 6, chh - 6)
        }
        if (playing === c && step >= 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)'
          ctx.fillRect(t * cw + 2, c * chh + chh - 6 * RES, ((cw - 4) * (step + 1)) / CL_STEPS, 4 * RES)
        }
      }
      ctx.fillStyle = cued === -1 ? '#ff5a4a' : '#5a5d65'
      fitFont(ctx, '■', cw, chh * 0.4, FONT, '700')
      ctx.fillText('■', t * cw + cw / 2, CL_SCENES * chh + chh / 2)
    }
    ctx.fillStyle = '#9aa0aa'
    for (let c = 0; c < CL_SCENES; c++) {
      fitFont(ctx, '▶', cw, chh * 0.4, FONT, '700')
      ctx.fillText('▶', CL_TRACKS * cw + cw / 2, c * chh + chh / 2)
    }
    // the editor
    const oct = Math.round(p[`oct${sel.t}`])
    for (let r = 0; r < ROWS; r++) {
      const black = [1, 3, 6, 8, 10].includes(r % 12)
      ctx.fillStyle = black ? '#17191c' : '#1e2125'
      ctx.fillRect(ex, H - (r + 2) * rh, W - ex, rh - 1)
    }
    for (let s = 0; s < CL_STEPS; s++) {
      if (s % 4 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fillRect(ex + s * sw, 0, RES, H)
      }
      const n = Math.round(p[clStep(sel.t, sel.c, s)])
      if (s === step && Math.round(p[`pl${sel.t}`]) === sel.c) {
        ctx.fillStyle = 'rgba(255,224,138,0.12)'
        ctx.fillRect(ex + s * sw, 0, sw, H)
      }
      if (n === CL_TIE) {
        ctx.fillStyle = COLS[sel.t]
        ctx.globalAlpha = 0.5
        ctx.fillRect(ex + s * sw, H - rh + 2, sw - 1, rh - 4)
        ctx.globalAlpha = 1
      } else if (n >= 0) {
        ctx.fillStyle = COLS[sel.t]
        ctx.fillRect(ex + s * sw + 1, H - (n + 2) * rh, sw - 2, rh - 1)
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.textAlign = 'left'
    ctx.font = `${Math.round(rh * 0.9)}px ${FONT}`
    ctx.fillText(`${NAMES[0]}${oct + 4}`, ex + 2, H - 1.5 * rh)
    ctx.fillText(`${NAMES[0]}${oct + 5}`, ex + 2, H - 13.5 * rh)
    ctx.fillText('TIE', ex + 2, H - 0.5 * rh)
  })

  const at = (e: { clientX: number; clientY: number }, r: DOMRect) => [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const [px, py] = at(e, e.currentTarget.getBoundingClientRect())
    if (px < gw) {
      const col = Math.floor(px / cw)
      const row = Math.floor(py / chh)
      if (row >= CL_SCENES && col < CL_TRACKS) sendSurface(mod, 'clips', col, CL_STOP, true)
      else if (col >= CL_TRACKS && row < CL_SCENES) sendSurface(mod, 'clips', row, CL_SCENE, true)
      else if (col < CL_TRACKS && row < CL_SCENES) {
        setSel({ t: col, c: row })
        if (!e.shiftKey) sendSurface(mod, 'clips', col * CL_SCENES + row, CL_LAUNCH, true)
      }
      return
    }
    if (px < ex) return
    const s = Math.min(CL_STEPS - 1, Math.floor((px - ex) / sw))
    const n = Math.floor((H - py) / rh) - 1
    if (n < 0 || n > 24) return
    const id = clStep(sel.t, sel.c, s)
    actions.setParam(mod, id, Math.round(live()[id]) === n ? -1 : n)
  }

  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const [px] = at(e, e.currentTarget.getBoundingClientRect())
    if (px < ex) return
    const s = Math.min(CL_STEPS - 1, Math.floor((px - ex) / sw))
    const id = clStep(sel.t, sel.c, s)
    actions.setParam(mod, id, Math.round(live()[id]) === CL_TIE ? -1 : CL_TIE)
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onContextMenu={context} />
}
