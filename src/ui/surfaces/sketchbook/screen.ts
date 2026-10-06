import { MIX, SB_COLORS, SB_ENGINE_KNOBS, SB_ENGINES, SB_MODES, SB_STEPS, SB_TRACKS, SBL, SEQ, SYNTH, TAPE } from '../../../modules/specs/sketchbook'

export interface ScreenRect {
  x: number
  y: number
  w: number
  h: number
}

/** What a screen draw needs: the module's params and live engine state. */
export interface ScreenState {
  p: Record<string, number>
  led: number[] | undefined
  t: number
  cursor: number
}

const BG = '#121418'
const INK = '#e9e4d8'
const DIM = 'rgba(233,228,216,0.35)'
const REC = '#ff4d3d'
const TAU = Math.PI * 2

const font = (px: number, weight = 600) => `${weight} ${Math.round(px)}px Bahnschrift, 'Arial Narrow', sans-serif`

/** The SKETCHBOOK screen: a header line, then the mode's own picture. */
export function drawScreen(ctx: CanvasRenderingContext2D, r: ScreenRect, s: ScreenState): void {
  const { p, led } = s
  ctx.fillStyle = BG
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h * 0.05)
  ctx.fill()
  const mode = Math.round(p.mode)
  const pad = r.h * 0.07
  const head = r.h * 0.14
  // header: mode, what's selected, transport
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = INK
  ctx.font = font(head * 0.75, 700)
  const sub =
    mode === SYNTH ? `${SB_ENGINES[Math.round(p.engine)]} · ${p.page >= 0.5 ? 'ENVELOPE' : 'SOUND'}` : mode === TAPE ? `TRACK ${Math.round(p.trk) + 1}` : mode === SEQ ? `${Math.round(p.tempo)} BPM` : 'LEVELS'
  ctx.fillText(`${SB_MODES[mode]}  ${sub}`, r.x + pad, r.y + pad + head / 2)
  ctx.textAlign = 'right'
  const recOn = (led?.[SBL.rec] ?? 0) > 0.5
  const run = (led?.[SBL.run] ?? 0) > 0.5
  ctx.fillStyle = recOn ? REC : run ? SB_COLORS[2] : DIM
  ctx.fillText(recOn ? '● REC' : run ? '▶ PLAY' : '■ STOP', r.x + r.w - pad, r.y + pad + head / 2)
  const body = { x: r.x + pad, y: r.y + pad * 1.5 + head, w: r.w - pad * 2, h: r.h - pad * 2.5 - head }
  if (mode === SEQ) drawSeq(ctx, body, s)
  else if (mode === TAPE) drawTape(ctx, body, s)
  else if (mode === MIX) drawMix(ctx, body, s)
  else if (p.page >= 0.5) drawEnvelope(ctx, body, s)
  else drawSound(ctx, body, s)
}

/** SYNTH · SOUND: the four knobs as coloured gauges, named. */
function drawSound(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const e = Math.round(s.p.engine)
  const names = SB_ENGINE_KNOBS[e].names
  const live = s.led?.[SBL.live] ?? 0
  for (let i = 0; i < 4; i++) {
    const v = s.p[`k${e}_${i}`] ?? 0
    const cx = b.x + (b.w * (i + 0.5)) / 4
    const cy = b.y + b.h * 0.42
    const rad = Math.min(b.w / 9, b.h * 0.32)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = rad * 0.28
    ctx.beginPath()
    ctx.arc(cx, cy, rad, Math.PI * 0.75, Math.PI * 2.25)
    ctx.stroke()
    ctx.strokeStyle = SB_COLORS[i]
    ctx.beginPath()
    ctx.arc(cx, cy, rad, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * v))
    ctx.stroke()
    // a pulse in the middle with the sound's level
    ctx.fillStyle = SB_COLORS[i]
    ctx.globalAlpha = 0.25 + Math.min(0.75, live * 2)
    ctx.beginPath()
    ctx.arc(cx, cy, rad * (0.2 + v * 0.35), 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.font = font(b.h * 0.13)
    ctx.fillText(names[i], cx, b.y + b.h * 0.9)
  }
}

/** SYNTH · ENVELOPE: the ADSR shape, each stage in its knob's colour. */
function drawEnvelope(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const { a, d, s: sus, r } = s.p
  const scale = (x: number) => Math.log10(1 + x * 40) / Math.log10(1 + 6 * 40)
  const wa = scale(a) * b.w * 0.28
  const wd = scale(d) * b.w * 0.28
  const ws = b.w * 0.16
  const wr = scale(r) * b.w * 0.28
  const top = b.y + b.h * 0.08
  const bot = b.y + b.h * 0.92
  const sy = bot - (bot - top) * sus
  const pts: [number, number][] = [
    [b.x, bot],
    [b.x + wa, top],
    [b.x + wa + wd, sy],
    [b.x + wa + wd + ws, sy],
    [b.x + wa + wd + ws + wr, bot],
  ]
  ctx.lineWidth = b.h * 0.05
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = SB_COLORS[i]
    ctx.beginPath()
    ctx.moveTo(...pts[i])
    ctx.lineTo(...pts[i + 1])
    ctx.stroke()
  }
}

/** SEQ: the pattern as bars (height = note), the playing step lit, the
 *  record cursor outlined, rests as dots. */
function drawSeq(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const len = Math.round(s.p.len)
  const step = s.led?.[SBL.step] ?? -1
  const cw = b.w / SB_STEPS
  for (let i = 0; i < SB_STEPS; i++) {
    const n = Math.round(s.p[`n${i}`] ?? -1)
    const x = b.x + i * cw
    const col = SB_COLORS[Math.floor(i / 4)]
    ctx.globalAlpha = i < len ? 1 : 0.25
    if (n < 0) {
      ctx.fillStyle = DIM
      ctx.beginPath()
      ctx.arc(x + cw / 2, b.y + b.h * 0.85, cw * 0.1, 0, TAU)
      ctx.fill()
    } else {
      const hgt = b.h * (0.12 + (n / 24) * 0.78)
      ctx.fillStyle = i === step ? INK : col
      ctx.fillRect(x + cw * 0.15, b.y + b.h - hgt, cw * 0.7, hgt)
    }
    if (i === s.cursor) {
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.strokeRect(x + cw * 0.05, b.y, cw * 0.9, b.h)
    }
    ctx.globalAlpha = 1
  }
}

/** TAPE: two reels turning while it plays, four lanes with the playhead. */
function drawTape(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const pos = s.led?.[SBL.pos] ?? 0
  const run = (s.led?.[SBL.run] ?? 0) > 0.5
  const rec = (s.led?.[SBL.rec] ?? 0) > 0.5
  const trk = Math.round(s.p.trk)
  const reelR = b.h * 0.3
  const spin = run ? s.t * 2.2 : 0
  for (const [k, cx] of [b.x + reelR, b.x + reelR * 3.3].entries()) {
    const cy = b.y + reelR
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, reelR * (k === 0 ? 0.95 - pos * 0.3 : 0.65 + pos * 0.3), 0, TAU)
    ctx.stroke()
    for (let sp = 0; sp < 3; sp++) {
      const a = spin + (sp * TAU) / 3
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * reelR * 0.5, cy + Math.sin(a) * reelR * 0.5)
      ctx.stroke()
    }
  }
  const lx = b.x + reelR * 4.6
  const lw = b.x + b.w - lx
  const lh = b.h / SB_TRACKS
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

/** MIX: a fader per tape track with its level meter. */
function drawMix(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  for (let t = 0; t < SB_TRACKS; t++) {
    const lv = s.p[`lv${t}`] ?? 0
    const peak = Math.min(1, (s.led?.[SBL.peak + t] ?? 0) * 1.5)
    const cx = b.x + (b.w * (t + 0.5)) / SB_TRACKS
    const w = b.w / SB_TRACKS / 5
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(cx - w / 2, b.y, w, b.h * 0.82)
    ctx.fillStyle = SB_COLORS[t]
    ctx.globalAlpha = 0.45
    ctx.fillRect(cx - w / 2, b.y + b.h * 0.82 * (1 - peak), w, b.h * 0.82 * peak)
    ctx.globalAlpha = 1
    const fy = b.y + b.h * 0.82 * (1 - lv)
    ctx.fillRect(cx - w * 1.6, fy - 2, w * 3.2, 4)
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.font = font(b.h * 0.13)
    ctx.fillText(String(t + 1), cx, b.y + b.h * 0.94)
  }
}
