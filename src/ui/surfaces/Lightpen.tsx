import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { LP_ROWS, LP_SCALE_STEPS, LP_STEPS, LPL } from '../../modules/specs/lightpen'
import { ERA_NAMES, SOUND_NAMES } from '../../modules/specs/sampling'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { fitFont, RES, useFrame, type SurfaceProps } from './common'

const FONT = "'Courier New', monospace"
const GREEN = '#5dff8a'
const DIM = '#1d4a2a'
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const HEAD = 0.16
const LABEL_W = 0.08

/** LIGHTPEN's green screen: the sound and era along the top; the grid below
 *  (time across, the scale's notes up, highest at the top). Click or drag
 *  across cells to light or clear them; lit cells in a row play as one note. */
export function Lightpen({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const head = H * HEAD
  const gx = W * LABEL_W
  const cw = (W - gx) / LP_STEPS
  const rh = (H - head) / LP_ROWS

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const led = telemetry.leds[mod]
    const step = led?.[LPL.step] ?? -1
    const rec = (led?.[LPL.rec] ?? 0) > 0
    ctx.fillStyle = '#040a06'
    ctx.fillRect(0, 0, W, H)
    // the header: what plays, through which era (or the recording)
    const s = Math.round(p.sound ?? 0)
    const title = rec ? `● RECORDING ${Math.round((led?.[LPL.fill] ?? 0) * 100)}%` : `${s < SOUND_NAMES.length ? SOUND_NAMES[s] : 'YOUR SAMPLE'} · ${ERA_NAMES[Math.round(p.era ?? 1)] ?? ''}`
    ctx.fillStyle = rec && Math.floor(now / 300) % 2 ? '#ff6b5d' : GREEN
    ctx.textAlign = 'left'
    fitFont(ctx, title, W - 12, head * 0.6, FONT, '700')
    ctx.fillText(title, 6, head * 0.72)
    // the rows' notes
    const scale = LP_SCALE_STEPS[Math.round(p.scale ?? 1)] ?? LP_SCALE_STEPS[0]
    const key = Math.round(p.key ?? 0)
    const oct = 4 + Math.round(p.oct ?? 0)
    for (let r = 0; r < LP_ROWS; r++) {
      const ry = head + (LP_ROWS - 1 - r) * rh
      const semis = key + scale[r]
      ctx.fillStyle = GREEN
      ctx.globalAlpha = 0.7
      ctx.textAlign = 'right'
      fitFont(ctx, `${NAMES[semis % 12]}${oct + Math.floor(semis / 12)}`, gx - 6, rh * 0.6, FONT, '700')
      ctx.fillText(`${NAMES[semis % 12]}${oct + Math.floor(semis / 12)}`, gx - 4, ry + rh * 0.68)
      ctx.globalAlpha = 1
      for (let c = 0; c < LP_STEPS; c++) {
        const on = (Math.round(p[`g${c}`] ?? 0) & (1 << r)) !== 0
        const cx = gx + c * cw
        ctx.fillStyle = on ? (c === step ? '#d8ffe4' : GREEN) : c === step ? '#173a22' : c % 4 === 0 ? '#0d2414' : '#08170d'
        ctx.fillRect(cx + 1.5, ry + 1.5, cw - 3, rh - 3)
        // a note that runs on into the next cell draws as one bar
        if (on && c < LP_STEPS - 1 && (Math.round(p[`g${c + 1}`] ?? 0) & (1 << r)) !== 0) ctx.fillRect(cx + cw - 2, ry + rh * 0.35, 4, rh * 0.3)
      }
    }
    ctx.strokeStyle = DIM
    ctx.lineWidth = 1
    ctx.strokeRect(gx, head, W - gx - 1, H - head - 1)
  })

  const cell = (e: { clientX: number; clientY: number }, r: DOMRect) => {
    const fx = ((e.clientX - r.left) / r.width) * W
    const fy = ((e.clientY - r.top) / r.height) * H
    if (fx < gx || fy < head) return null
    return { c: Math.min(LP_STEPS - 1, Math.floor((fx - gx) / cw)), row: LP_ROWS - 1 - Math.min(LP_ROWS - 1, Math.floor((fy - head) / rh)) }
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const first = cell(e, r)
    if (!first) return
    const p = live()
    // the first cell decides: light (or clear) everything dragged over
    const lighting = (Math.round(p[`g${first.c}`] ?? 0) & (1 << first.row)) === 0
    const paint = (at: { c: number; row: number }) => {
      const id = `g${at.c}`
      const v = Math.round(live()[id] ?? 0)
      actions.setParams([[mod, id, lighting ? v | (1 << at.row) : v & ~(1 << at.row)]], `lightpen-${mod}`)
    }
    paint(first)
    track(
      (ev) => {
        const at = cell(ev, r)
        if (at && at.row === first.row) paint(at)
      },
      () => {},
    )
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} />
}
