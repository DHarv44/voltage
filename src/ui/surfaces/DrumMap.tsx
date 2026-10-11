import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { DM_NODE_NAMES, dmLevel } from '../../modules/specs/drummapNodes'
import { DM_STEPS, DML } from '../../modules/specs/seq2'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { fitFont, RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const MAP = 0.42
const COLS = ['#ff7b54', '#ffd166', '#7fd6ff']
const FILL = ['dbd', 'dsd', 'dhh']

/** DRUM MAP's screen: the map of grooves on the left (drag the dot to move
 *  across it), and on the right the pattern it makes there, kick, snare and
 *  hat, each 16th lit if it plays at the FILL set (the step playing shown). */
export function DrumMap({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const mw = W * MAP

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const led = telemetry.leds[mod]
    ctx.fillStyle = '#111214'
    ctx.fillRect(0, 0, W, H)
    // the map
    const cw = mw / 3
    const ch = H / 3
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#1a1c20' : '#1f2227'
        ctx.fillRect(c * cw, r * ch, cw, ch)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        fitFont(ctx, DM_NODE_NAMES[r][c], cw - 6, ch * 0.16, FONT, '600')
        ctx.fillText(DM_NODE_NAMES[r][c], c * cw + cw / 2, r * ch + ch / 2)
      }
    ctx.fillStyle = '#ffe08a'
    ctx.beginPath()
    ctx.arc(p.x * mw, p.y * H, 5 * RES, 0, Math.PI * 2)
    ctx.fill()
    // the pattern here
    const px = mw + 6 * RES
    const pw = (W - px) / DM_STEPS
    const rh = H / 3
    const step = led?.[DML.step] ?? -1
    for (let d = 0; d < 3; d++)
      for (let s = 0; s < DM_STEPS; s++) {
        const lv = dmLevel(d, s, p.x, p.y)
        const on = lv > 0.02 && lv > 1 - p[FILL[d]]
        ctx.fillStyle = s === step ? '#3d3420' : s % 4 === 0 ? '#25282d' : '#1b1d21'
        ctx.fillRect(px + s * pw + 1, d * rh + 2, pw - 2, rh - 4)
        if (lv > 0.02) {
          ctx.globalAlpha = on ? 1 : 0.25
          ctx.fillStyle = COLS[d]
          const bh = (rh - 6) * lv
          ctx.fillRect(px + s * pw + 2, d * rh + rh - 3 - bh, pw - 4, bh)
          ctx.globalAlpha = 1
        }
      }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    if (((e.clientX - r.left) / r.width) * W > mw) return
    e.stopPropagation()
    e.preventDefault()
    const set = (cx: number, cy: number) =>
      actions.setParams(
        [
          [mod, 'x', Math.max(0, Math.min(1, ((cx - r.left) / r.width) * (W / mw)))],
          [mod, 'y', Math.max(0, Math.min(1, (cy - r.top) / r.height))],
        ],
        `drummap:${mod}`,
      )
    set(e.clientX, e.clientY)
    track(
      (ev) => set(ev.clientX, ev.clientY),
      () => {},
    )
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} />
}
