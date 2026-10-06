import {
  encoderLabels,
  lfoTarget,
  MIX,
  SB_COLORS,
  SB_ENGINE_KNOBS,
  SB_ENGINES,
  SB_FX,
  SB_LFO_SHAPES,
  SB_MODES,
  SB_PAGES,
  SB_SEQS,
  SB_TRACKS,
  SBL,
  SEQ,
  SYNTH,
  TAPE,
} from '../../../modules/specs/sketchbook'
import { drawSequencer } from './seqScreen'

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
    mode === SYNTH
      ? `${SB_ENGINES[Math.round(p.engine)]} · ${Math.round(p.page) === 2 ? `FX ${SB_FX[Math.round(p.fx)]}` : SB_PAGES[Math.round(p.page)]}`
      : mode === TAPE
        ? `TRACK ${Math.round(p.trk) + 1}`
        : mode === SEQ
          ? `${SB_SEQS[Math.round(p.stype)]} · ${Math.round(p.tempo)}`
          : 'LEVELS'
  ctx.fillText(`${SB_MODES[mode]}  ${sub}`, r.x + pad, r.y + pad + head / 2)
  ctx.textAlign = 'right'
  const recOn = (led?.[SBL.rec] ?? 0) > 0.5
  const run = (led?.[SBL.run] ?? 0) > 0.5
  ctx.fillStyle = recOn ? REC : run ? SB_COLORS[2] : DIM
  ctx.fillText(recOn ? '● REC' : run ? '▶ PLAY' : '■ STOP', r.x + r.w - pad, r.y + pad + head / 2)
  const body = { x: r.x + pad, y: r.y + pad * 1.5 + head, w: r.w - pad * 2, h: r.h - pad * 2.5 - head }
  if (mode === SEQ) drawSequencer(ctx, body, s)
  else if (mode === TAPE) drawTape(ctx, body, s)
  else if (mode === MIX) drawMix(ctx, body, s)
  else [drawSound, drawEnvelope, drawFx, drawLfo][Math.round(p.page)]?.(ctx, body, s)
}

/** SYNTH · SOUND: the engine's four knobs as coloured gauges. */
function drawSound(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const e = Math.round(s.p.engine)
  drawGauges(ctx, b, s, SB_ENGINE_KNOBS[e].names, [0, 1, 2, 3].map((i) => s.p[`k${e}_${i}`] ?? 0))
}

/** SYNTH · FX: the effect's knobs (the first one picks the effect). */
function drawFx(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const p = s.p
  drawGauges(ctx, b, s, encoderLabels(p, (id) => id), [p.fx / (SB_FX.length - 1), p.fxmix, p.fxa, p.fxb])
}

/** SYNTH · LFO: its wave, a dot running along it at RATE, and what it moves. */
function drawLfo(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState): void {
  const p = s.p
  const shape = Math.round(p.lfo)
  const amp = (b.h * 0.36) * Math.max(0.08, p.ldepth)
  const mid = b.y + b.h * 0.42
  const wave = (ph: number) =>
    shape === 1 ? 1 - 4 * Math.abs(ph - 0.5) : shape === 2 ? (ph < 0.5 ? 1 : -1) : shape === 3 ? Math.sin(ph * 37.1 + Math.floor(ph * 6) * 1.7) : Math.sin(TAU * ph)
  ctx.strokeStyle = SB_COLORS[1]
  ctx.lineWidth = b.h * 0.035
  ctx.beginPath()
  for (let i = 0; i <= 64; i++) {
    const ph = i / 64
    const y = mid - wave(shape === 3 ? Math.floor(ph * 6) / 6 : ph) * amp
    if (i === 0) ctx.moveTo(b.x + ph * b.w, y)
    else ctx.lineTo(b.x + ph * b.w, y)
  }
  ctx.stroke()
  const at = (s.t * p.lrate) % 1
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(b.x + at * b.w, mid - wave(shape === 3 ? Math.floor(at * 6) / 6 : at) * amp, b.h * 0.06, 0, TAU)
  ctx.fill()
  ctx.fillStyle = SB_COLORS[3]
  ctx.textAlign = 'center'
  ctx.font = font(b.h * 0.14)
  ctx.fillText(`${SB_LFO_SHAPES[shape]}  →  ${lfoTarget(p)}`, b.x + b.w / 2, b.y + b.h * 0.92)
}

/** Four coloured gauges with names, pulsing with the sound's level. */
function drawGauges(ctx: CanvasRenderingContext2D, b: ScreenRect, s: ScreenState, names: string[], values: number[]): void {
  const live = s.led?.[SBL.live] ?? 0
  for (let i = 0; i < 4; i++) {
    const v = values[i] ?? 0
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
