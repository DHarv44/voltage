import { ARP, DRIFT, SB_ARP_MODES, SB_ARP_RATES, SB_BALLS, SB_COLORS, SB_STEPS, SBL, TUMBLE } from '../../../modules/specs/sketchbook'
import type { ScreenRect, ScreenState } from './screen'

const INK = '#e9e4d8'
const DIM = 'rgba(233,228,216,0.35)'
const TAU = Math.PI * 2
const font = (px: number) => `600 ${Math.round(px)}px Bahnschrift, 'Arial Narrow', sans-serif`

/** SEQ's picture, by sequencer type. */
export function drawSequencer(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const type = Math.round(s.p.stype)
  if (type === TUMBLE) drawDrum(ctx, b, s)
  else if (type === ARP) drawArp(ctx, b, s)
  else drawSteps(ctx, b, s, type === DRIFT ? (i) => s.led?.[SBL.drift + i] ?? -1 : (i) => s.p[`n${i}`] ?? -1, type !== DRIFT)
}

/** PATTERN / DRIFT: bars (height = note), the playing step lit, rests as dots;
 *  PATTERN also shows the record cursor. */
function drawSteps(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState, note: (i: number) => number, cursor: boolean): void {
  const len = Math.round(s.p.len)
  const step = s.led?.[SBL.step] ?? -1
  const cw = b.w / SB_STEPS
  for (let i = 0; i < SB_STEPS; i++) {
    const n = Math.round(note(i))
    const x = b.x + i * cw
    ctx.globalAlpha = i < len ? 1 : 0.25
    if (n < 0) {
      ctx.fillStyle = DIM
      ctx.beginPath()
      ctx.arc(x + cw / 2, b.y + b.h * 0.85, cw * 0.1, 0, TAU)
      ctx.fill()
    } else {
      const hgt = b.h * (0.12 + (n / 24) * 0.78)
      ctx.fillStyle = i === step ? INK : SB_COLORS[Math.floor(i / 4)]
      ctx.fillRect(x + cw * 0.15, b.y + b.h - hgt, cw * 0.7, hgt)
    }
    if (cursor && i === s.cursor) {
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.strokeRect(x + cw * 0.05, b.y, cw * 0.9, b.h)
    }
    ctx.globalAlpha = 1
  }
}

/** TUMBLE: the drum turning, its walls coloured by their notes, the balls. */
function drawDrum(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const sides = Math.min(8, Math.max(3, Math.round(s.p.len)))
  const rad = Math.min(b.w, b.h) * 0.48
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const angle = (s.led?.[SBL.angle] ?? 0) * TAU
  ctx.lineWidth = rad * 0.07
  ctx.lineCap = 'round'
  for (let k = 0; k < sides; k++) {
    const a0 = angle + (TAU * k) / sides
    const a1 = angle + (TAU * (k + 1)) / sides
    const n = Math.round(s.p[`n${k}`] ?? -1)
    ctx.strokeStyle = n < 0 ? DIM : SB_COLORS[k % 4]
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a0) * rad, cy - Math.sin(a0) * rad)
    ctx.lineTo(cx + Math.cos(a1) * rad, cy - Math.sin(a1) * rad)
    ctx.stroke()
  }
  ctx.fillStyle = INK
  for (let i = 0; i < SB_BALLS; i++) {
    const bx = s.led?.[SBL.balls + i * 2] ?? -1
    if (bx < 0) continue
    const by = s.led?.[SBL.balls + i * 2 + 1] ?? 0
    ctx.beginPath()
    ctx.arc(cx + (bx * 2 - 1) * rad, cy - (by * 2 - 1) * rad, rad * 0.075, 0, TAU)
    ctx.fill()
  }
}

/** ARP: the held keys as dots (pitch up the screen), the rate and the mode. */
function drawArp(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const count = Math.round(s.led?.[SBL.arpCount] ?? 0)
  const now = s.led?.[SBL.note] ?? 0
  ctx.textAlign = 'center'
  ctx.font = font(b.h * 0.14)
  ctx.fillStyle = SB_COLORS[3]
  ctx.fillText(`${SB_ARP_MODES[Math.round(s.p.amode)]} · ${SB_ARP_RATES[Math.round(s.p.arate)]} · ${Math.round(s.p.aoct)} OCT`, b.x + b.w / 2, b.y + b.h * 0.92)
  if (!count) {
    ctx.fillStyle = DIM
    ctx.fillText('hold some keys', b.x + b.w / 2, b.y + b.h * 0.45)
    return
  }
  for (let i = 0; i < count; i++) {
    const n = s.led?.[SBL.arp + i] ?? 0
    const x = b.x + (b.w * (i + 0.5)) / count
    const y = b.y + b.h * (0.7 - (((n % 24) + 24) % 24) / 24 * 0.6)
    const on = ((now - n) % 12 + 12) % 12 === 0
    ctx.fillStyle = on ? INK : SB_COLORS[i % 4]
    ctx.beginPath()
    ctx.arc(x, y, b.h * (on ? 0.09 : 0.065), 0, TAU)
    ctx.fill()
  }
}
