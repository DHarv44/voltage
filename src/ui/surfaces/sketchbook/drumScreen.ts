import { SB_COLORS, SB_DRUMS, SB_STEPS, SBL } from '../../../modules/specs/sketchbook'
import type { ScreenRect, ScreenState } from './screen'

const INK = '#e9e4d8'
const font = (px: number) => `600 ${Math.round(px)}px Bahnschrift, 'Arial Narrow', sans-serif`

/** The DRUM grid inside the screen's body: a name column, then 16 steps per row. */
function grid(b: ScreenRect) {
  const nameW = b.w * 0.15
  return { x: b.x + nameW, y: b.y, cw: (b.w - nameW) / SB_STEPS, rh: b.h / SB_DRUMS.length, nameW }
}

/** Which cell a point (canvas pixels) is in, if any: [sound, step]. */
export function drumCellAt(b: ScreenRect, px: number, py: number): [number, number] | null {
  const g = grid(b)
  const step = Math.floor((px - g.x) / g.cw)
  const sound = Math.floor((py - g.y) / g.rh)
  if (sound < 0 || sound >= SB_DRUMS.length || px < b.x || px > b.x + b.w) return null
  return [sound, Math.max(-1, Math.min(SB_STEPS - 1, step))]
}

/** DRUM: a row of 16 steps per sound (click a cell to toggle it, click a name
 *  to pick the sound); the playing step, a flash as each sound hits. */
export function drawDrums(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const g = grid(b)
  const sel = Math.round(s.p.dsel)
  const step = s.led?.[SBL.dstep] ?? -1
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = font(g.rh * 0.62)
  for (let d = 0; d < SB_DRUMS.length; d++) {
    const y = g.y + d * g.rh
    const mask = s.p[`dm${d}`] ?? 0
    const flash = s.led?.[SBL.dflash + d] ?? 0
    const col = SB_COLORS[d % 4]
    if (d === sel) {
      ctx.fillStyle = 'rgba(255,255,255,0.09)'
      ctx.fillRect(b.x, y, b.w, g.rh)
    }
    ctx.fillStyle = flash > 0.05 ? col : d === sel ? INK : 'rgba(233,228,216,0.6)'
    ctx.fillText(SB_DRUMS[d], b.x + 2, y + g.rh / 2)
    for (let i = 0; i < SB_STEPS; i++) {
      const on = (mask >> i) & 1
      const x = g.x + i * g.cw
      ctx.fillStyle = on ? (i === step ? INK : col) : i === step ? 'rgba(255,255,255,0.18)' : i % 4 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)'
      ctx.fillRect(x + g.cw * 0.12, y + g.rh * 0.15, g.cw * 0.76, g.rh * 0.7)
    }
  }
}
