import {
  chainId,
  K,
  lfoDestIndex,
  lfoRateIndex,
  LS_LFO_DESTS,
  LS_LFO_RATES,
  encoderLabels,
  encoderParams,
  LOCK_PAGES,
  lockId,
  lockValue,
  LS_ALGOS,
  LS_PAGES,
  LS_PATTERNS,
  LS_RATIOS,
  LS_STEPS,
  LS_TRACK_COLORS,
  LS_TRACKS,
  LSL,
  ratioIndex,
  trigsId,
  TRIG,
} from '../../../modules/specs/lockstep'
import type { ParamSpec } from '../../../modules/types'
import { fitFont } from '../common'

const BG = '#101114'
const INK = '#e6e3dc'
const DIM = 'rgba(230,227,220,0.35)'
const LOCK = '#ff8a2b'
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FAMILY = "Bahnschrift, 'Arial Narrow', sans-serif"
const font = (px: number, weight = 600) => `${weight} ${Math.round(px)}px ${FAMILY}`

export interface LsScreen {
  p: Record<string, number>
  led: ArrayLike<number> | undefined
  sel: number
  spec: (id: string) => ParamSpec
  /** A passing message (after a copy or paste) for the header. */
  note: string
  /** A chain is being written. */
  writing: boolean
}

/** The chain as letters, the slot playing in brackets. */
function chainText(p: Record<string, number>, slot: number): string {
  const len = Math.round(p.chlen ?? 0)
  const out: string[] = []
  for (let i = 0; i < len; i++) {
    const l = LS_PATTERNS[Math.round(p[chainId(i)] ?? 0)]
    out.push(i === slot ? `[${l}]` : l)
  }
  return out.join(' ')
}

const noteName = (semis: number) => `${NOTES[((semis % 12) + 12) % 12]}${Math.floor(semis / 12) + 4}`
export const hasLocks = (p: Record<string, number>, t: number, s: number, pat: number) => {
  for (let page = 0; page < LOCK_PAGES; page++) if ((p[lockId(t, s, page, pat)] ?? 0) !== 0) return true
  return false
}

/** A knob's value as the screen shows it. */
function show(id: string, v: number, ps: ParamSpec, p: Record<string, number>): string {
  if (id.startsWith('k') && id.endsWith('_0')) return LS_RATIOS[ratioIndex(v)].join(':')
  // the LFO page: rate, bipolar amount, destination
  if (id.startsWith('k') && id.endsWith(`_${K.lfoSpd}`)) return LS_LFO_RATES[lfoRateIndex(v)]
  if (id.startsWith('k') && id.endsWith(`_${K.lfoAmt}`)) return `${v > 0.5 ? '+' : ''}${Math.round((v - 0.5) * 200)}`
  if (id.startsWith('k') && id.endsWith(`_${K.lfoDest}`)) return LS_LFO_DESTS[lfoDestIndex(v)]
  if (/^([A-D]\.)?n\d/.test(id)) return noteName(Math.round(p[`root${Math.round(p.trk)}`]) + Math.round(v))
  if (ps.options) return ps.options[Math.round(v)] ?? ''
  if (ps.unit === 'bpm') return String(Math.round(v))
  if (ps.unit === 'st') return `${v > 0 ? '+' : ''}${Math.round(v)}`
  if (ps.stepped) return String(Math.round(v))
  return String(Math.round(((v - ps.min) / (ps.max - ps.min)) * 100))
}

/** The LOCKSTEP screen: the track and page, the four encoders' values (a
 *  selected step shows its locks in amber over the track's dimmed values),
 *  and every track's steps underneath, so the polymeter shows. */
export function drawLsScreen(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, s: LsScreen): void {
  const { p, led, sel } = s
  const t = Math.round(p.trk)
  const page = Math.round(p.page)
  const pat = Math.round(p.pat ?? 0)
  const playing = Math.round(led?.[LSL.pat] ?? 0)
  ctx.fillStyle = BG
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h * 0.05)
  ctx.fill()
  const pad = r.h * 0.06
  const head = r.h * 0.13
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = font(head * 0.72, 700)
  ctx.fillStyle = INK
  ctx.fillText(LS_PATTERNS[pat], r.x + pad, r.y + pad + head / 2)
  ctx.fillStyle = LS_TRACK_COLORS[t]
  ctx.fillText(`T${t + 1}`, r.x + pad + head * 0.8, r.y + pad + head / 2)
  ctx.fillStyle = INK
  const algo = `${LS_ALGOS[Math.round(p[`algo${t}`])]}`
  const leftText = `${LS_PAGES[page]} · ${algo}`
  ctx.fillText(leftText, r.x + pad + head * 2, r.y + pad + head / 2)
  const room = r.w - pad * 2 - head * 2.6 - ctx.measureText(leftText).width
  ctx.textAlign = 'right'
  const run = p.run >= 0.5
  // a message, the picked step, the chain, the pattern still to come, or the transport
  const chain = s.writing || (p.chon ?? 0) >= 0.5 ? `CHAIN ${chainText(p, s.writing ? -1 : Math.round(led?.[LSL.chain] ?? -1))}${s.writing ? ' _' : ''}` : ''
  const right =
    s.note || (sel >= 0 ? `STEP ${sel + 1}` : chain || (run && playing !== pat ? `${LS_PATTERNS[playing]} → ${LS_PATTERNS[pat]}` : `${run ? '▶' : '■'} ${Math.round(p.tempo)}`))
  ctx.fillStyle = s.note || sel >= 0 || chain || (run && playing !== pat) ? LOCK : run ? INK : DIM
  fitFont(ctx, right, room, head * 0.72, FAMILY, '700')
  ctx.fillText(right, r.x + r.w - pad, r.y + pad + head / 2)

  // the four encoders' values
  const top = r.y + pad * 1.6 + head
  const colH = r.h * 0.4
  const colW = (r.w - pad * 2) / 4
  const ids = encoderParams(p, sel)
  const labels = encoderLabels(p)
  if (page === TRIG && sel < 0) {
    ctx.textAlign = 'center'
    ctx.fillStyle = DIM
    ctx.font = font(head * 0.6)
    ctx.fillText('Right-click a step (or hold it) to pick it', r.x + r.w / 2, top + colH * 0.4)
  }
  ids.forEach((id, i) => {
    if (!id) return
    const ps = s.spec(id)
    const cx = r.x + pad + colW * (i + 0.5)
    // a lock page with a step picked: the lock if there is one
    let v = p[id] ?? ps.def
    let locked = false
    if (page < LOCK_PAGES && sel >= 0) {
      const lv = lockValue(p[lockId(t, sel, page, pat)] ?? 0, i)
      if (lv >= 0) {
        v = lv
        locked = true
      }
    }
    const frac = (v - ps.min) / (ps.max - ps.min)
    ctx.textAlign = 'center'
    ctx.font = font(head * 0.55)
    ctx.fillStyle = DIM
    ctx.fillText(labels[i], cx, top + colH * 0.1)
    ctx.font = font(head * 0.85, 700)
    ctx.fillStyle = locked ? LOCK : page < LOCK_PAGES && sel >= 0 ? DIM : INK
    ctx.fillText(show(id, v, ps, p), cx, top + colH * 0.42)
    const bw = colW * 0.7
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(cx - bw / 2, top + colH * 0.72, bw, colH * 0.08)
    ctx.fillStyle = locked ? LOCK : INK
    ctx.fillRect(cx - bw / 2, top + colH * 0.72, bw * Math.max(0, Math.min(1, frac)), colH * 0.08)
  })

  // every track's steps: trigs, length, playhead
  const laneTop = top + colH + pad * 0.6
  const laneH = (r.y + r.h - pad - laneTop) / LS_TRACKS
  const cw = (r.w - pad * 2) / LS_STEPS
  for (let k = 0; k < LS_TRACKS; k++) {
    const len = Math.round(p[`len${k}`])
    const mask = Math.round(p[trigsId(k, pat)])
    const at = playing === pat ? (led?.[LSL.step + k] ?? -1) : -1
    for (let st = 0; st < LS_STEPS; st++) {
      const on = ((mask >>> st) & 1) === 1
      ctx.globalAlpha = st < len ? 1 : 0.15
      ctx.fillStyle = st === at ? INK : on ? LS_TRACK_COLORS[k] : 'rgba(255,255,255,0.12)'
      ctx.fillRect(r.x + pad + st * cw + 1, laneTop + k * laneH + laneH * 0.18, cw - 2, laneH * 0.64)
    }
    ctx.globalAlpha = 1
    if (k === t) {
      ctx.strokeStyle = LS_TRACK_COLORS[k]
      ctx.lineWidth = 1.5
      ctx.strokeRect(r.x + pad - 2, laneTop + k * laneH + 1, r.w - pad * 2 + 4, laneH - 2)
    }
  }
}
