import { SB_COLORS, SB_TRACKS, SBL } from '../../../modules/specs/sketchbook'
import type { ScreenRect, ScreenState } from './screen'

const INK = '#e9e4d8'
const REC = '#ff4d3d'
const TAU = Math.PI * 2
const font = (px: number) => `700 ${Math.round(px)}px Bahnschrift, 'Arial Narrow', sans-serif`

/** Where things are in the TAPE picture (shared by drawing and touching). */
function layout(b: ScreenRect) {
  const reelR = b.h * 0.3
  const lx = b.x + reelR * 4.6
  const btn = { w: reelR * 2, h: b.h * 0.24 }
  return {
    reelR,
    lane: { x: lx, w: b.x + b.w - lx, h: b.h / SB_TRACKS },
    lift: { x: b.x, y: b.y + b.h - btn.h, w: btn.w, h: btn.h },
    drop: { x: b.x + btn.w + reelR * 0.4, y: b.y + b.h - btn.h, w: btn.w, h: btn.h },
  }
}

const inside = (r: { x: number; y: number; w: number; h: number }, px: number, py: number) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h

/** What a touch on the TAPE screen hits: a track lane (pick it), or (TRICKS
 *  page) LIFT / DROP. */
export function tapeHit(b: ScreenRect, tricks: boolean, px: number, py: number): { lane: number } | 'lift' | 'drop' | null {
  const L = layout(b)
  if (tricks && inside(L.lift, px, py)) return 'lift'
  if (tricks && inside(L.drop, px, py)) return 'drop'
  if (px >= L.lane.x && py >= b.y && py <= b.y + b.h) return { lane: Math.min(SB_TRACKS - 1, Math.floor((py - b.y) / L.lane.h)) }
  return null
}

/** TAPE: two reels turning (faster or backwards with the tape), four lanes
 *  with the playhead; TRICKS shades the loop stretch and offers LIFT / DROP. */
export function drawTape(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const L = layout(b)
  const p = s.p
  const pos = s.led?.[SBL.pos] ?? 0
  const run = (s.led?.[SBL.run] ?? 0) > 0.5
  const rec = (s.led?.[SBL.rec] ?? 0) > 0.5
  const trk = Math.round(p.trk)
  const tricks = Math.round(p.tpage) === 1
  const spin = run ? s.t * 2.2 * p.tspd : 0
  const reelY = b.y + L.reelR * (tricks ? 0.9 : 1)
  for (const [k, cx] of [b.x + L.reelR, b.x + L.reelR * 3.3].entries()) {
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, reelY, L.reelR * (k === 0 ? 0.95 - pos * 0.3 : 0.65 + pos * 0.3) * (tricks ? 0.8 : 1), 0, TAU)
    ctx.stroke()
    for (let sp = 0; sp < 3; sp++) {
      const a = spin + (sp * TAU) / 3
      ctx.beginPath()
      ctx.moveTo(cx, reelY)
      ctx.lineTo(cx + Math.cos(a) * L.reelR * 0.45, reelY + Math.sin(a) * L.reelR * 0.45)
      ctx.stroke()
    }
  }
  const { x: lx, w: lw, h: lh } = L.lane
  if (tricks) {
    // the loop stretch, and how fast (and which way) the tape runs
    const a = Math.min(p.tin, p.tout)
    const z = Math.max(p.tin, p.tout)
    ctx.fillStyle = 'rgba(74,168,255,0.16)'
    ctx.fillRect(lx + a * lw, b.y, (z - a) * lw, b.h)
    ctx.fillStyle = SB_COLORS[3]
    ctx.fillRect(lx + a * lw - 1, b.y, 2, b.h)
    ctx.fillRect(lx + z * lw - 1, b.y, 2, b.h)
    for (const [label, r] of [['LIFT', L.lift], ['DROP', L.drop]] as const) {
      ctx.fillStyle = 'rgba(233,228,216,0.15)'
      ctx.beginPath()
      ctx.roundRect(r.x, r.y, r.w, r.h, r.h * 0.25)
      ctx.fill()
      ctx.fillStyle = INK
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = font(r.h * 0.5)
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2)
    }
  }
  for (let t = 0; t < SB_TRACKS; t++) {
    const y = b.y + t * lh
    const peak = s.led?.[SBL.peak + t] ?? 0
    ctx.fillStyle = t === trk ? (rec ? 'rgba(255,77,61,0.25)' : 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.04)'
    ctx.fillRect(lx, y + lh * 0.12, lw, lh * 0.76)
    ctx.fillStyle = SB_COLORS[t]
    ctx.fillRect(lx, y + lh * 0.12, Math.min(1, peak * 1.5) * lw * 0.12 + 2, lh * 0.76)
  }
  ctx.fillStyle = rec ? REC : INK
  ctx.fillRect(lx + pos * lw - 1, b.y, 2, b.h)
}
