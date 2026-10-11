import { useRef, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { DK_FIELD_NAMES, DK_FIELDS, DK_MODES, DK_OWN, DK_SOUNDS, DK_STEPS, DK_TRACKS, dkId, DKL } from '../../modules/specs/deck'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { fitFont, RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const GRID = 0.5
const HEAD = 0.07
const LABEL = 0.17
const RANGE: Record<(typeof DK_FIELDS)[number], [number, number]> = { cut: [0, 1], pit: [-12, 12], lvl: [0, 1], crs: [0, 1] }
const TRACK_COL = ['#ffb347', '#7fd6ff', '#ff7f9e', '#a6f07a']
const A_COL = '#5b9bd5'
const B_COL = '#ff8a3d'

/** DECK's screen. Top: each track's sound and play mode (click the sound
 *  for the next, scroll to step it; click the mode to switch SLICE/HIT) and
 *  its sixteen trigs (click to set or clear). Below: the two scenes, each
 *  track's CUTOFF, PITCH, LEVEL and CRUSH as an A slider over a B slider
 *  (drag along them); the white mark is where the crossfader has them now. */
export function Deck({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const lw = W * LABEL
  const gh = H * GRID
  const rh = gh / DK_TRACKS
  const cw = (W - lw) / DK_STEPS
  const sy = gh + H * HEAD
  const sh = (H - sy) / DK_TRACKS
  const fw = (W - lw) / DK_FIELDS.length

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const led = telemetry.leds[mod]
    const step = led?.[DKL.step] ?? -1
    const recTrk = led?.[DKL.rec] ?? -1
    const armed = led?.[DKL.armed] ?? 0
    const xf = p.xf ?? 0
    ctx.fillStyle = '#111214'
    ctx.fillRect(0, 0, W, H)
    ctx.textBaseline = 'middle'
    for (let t = 0; t < DK_TRACKS; t++) {
      const ty = t * rh
      const snd = Math.round(p[`snd${t}`] ?? 0)
      const empty = snd === DK_OWN && !(led?.[DKL.own0 + t] ?? 0)
      // the label: sound, mode, meter
      ctx.fillStyle = '#1b1d21'
      ctx.fillRect(1, ty + 1, lw - 2, rh - 2)
      ctx.fillStyle = TRACK_COL[t]
      ctx.fillRect(1, ty + 1, 3 * RES, rh - 2)
      const rec = recTrk === t ? 'REC' : armed > 0 && Math.round(p.rectrk ?? 3) === t ? 'ARMED' : ''
      const name = rec || (empty ? 'OWN (EMPTY)' : DK_SOUNDS[snd])
      ctx.fillStyle = rec ? (Math.floor(now / 250) % 2 || recTrk === t ? '#ff3b2f' : '#6a2a26') : empty ? '#6a6d75' : '#ece7da'
      ctx.textAlign = 'left'
      fitFont(ctx, name, lw - 10 * RES, rh * 0.34, FONT, '700')
      ctx.fillText(name, 6 * RES, ty + rh * 0.3)
      ctx.fillStyle = '#9aa0aa'
      const mode = DK_MODES[Math.round(p[`pm${t}`] ?? 0)]
      fitFont(ctx, mode, lw * 0.5, rh * 0.26, FONT, '600')
      ctx.fillText(mode, 6 * RES, ty + rh * 0.72)
      const lv = Math.min(1, (led?.[DKL.level0 + t] ?? 0) * 1.4)
      ctx.fillStyle = '#2a2c31'
      ctx.fillRect(lw * 0.55, ty + rh * 0.64, lw * 0.4, rh * 0.16)
      ctx.fillStyle = lv > 0.9 ? '#ff4a3a' : TRACK_COL[t]
      ctx.fillRect(lw * 0.55, ty + rh * 0.64, lw * 0.4 * lv, rh * 0.16)
      // the trigs
      const m = Math.round(p[`m${t}`] ?? 0)
      for (let i = 0; i < DK_STEPS; i++) {
        const on = (m >> i) & 1
        const cx = lw + i * cw
        ctx.fillStyle = on ? (i === step ? '#fff3c4' : TRACK_COL[t]) : i === step ? '#3d3420' : i % 4 === 0 ? '#25282d' : '#1c1e22'
        ctx.globalAlpha = on && i !== step ? 0.8 : 1
        ctx.fillRect(cx + 1.5, ty + 2, cw - 3, rh - 4)
        ctx.globalAlpha = 1
      }
    }
    // the scenes' header: the crossfader
    const hy = gh + H * HEAD * 0.5
    ctx.fillStyle = A_COL
    ctx.textAlign = 'left'
    fitFont(ctx, 'A', lw, H * HEAD * 0.7, FONT, '700')
    ctx.fillText('A', 6 * RES, hy)
    ctx.fillStyle = B_COL
    ctx.textAlign = 'right'
    ctx.fillText('B', lw - 6 * RES, hy)
    ctx.fillStyle = '#050505'
    ctx.fillRect(lw * 0.22, hy - 1.5 * RES, lw * 0.5, 3 * RES)
    ctx.fillStyle = '#d9dcdf'
    ctx.fillRect(lw * 0.22 + lw * 0.5 * xf - 3 * RES, hy - 5 * RES, 6 * RES, 10 * RES)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#9aa0aa'
    for (let f = 0; f < DK_FIELDS.length; f++) {
      fitFont(ctx, DK_FIELD_NAMES[f], fw - 8, H * HEAD * 0.6, FONT, '600')
      ctx.fillText(DK_FIELD_NAMES[f], lw + f * fw + fw / 2, hy)
    }
    // the scenes
    for (let t = 0; t < DK_TRACKS; t++) {
      const ty = sy + t * sh
      ctx.fillStyle = TRACK_COL[t]
      ctx.textAlign = 'center'
      fitFont(ctx, `${t + 1}`, lw, sh * 0.6, FONT, '700')
      ctx.fillText(`${t + 1}`, lw / 2, ty + sh / 2)
      DK_FIELDS.forEach((f, fi) => {
        const [lo, hi] = RANGE[f]
        const a = ((p[dkId('a', t, f)] ?? lo) - lo) / (hi - lo)
        const b = ((p[dkId('b', t, f)] ?? lo) - lo) / (hi - lo)
        const fx = lw + fi * fw + 4 * RES
        const bw = fw - 8 * RES
        ctx.fillStyle = '#1b1d21'
        ctx.fillRect(fx, ty + 2, bw, sh / 2 - 3)
        ctx.fillRect(fx, ty + sh / 2 + 1, bw, sh / 2 - 3)
        ctx.fillStyle = A_COL
        ctx.fillRect(fx, ty + 2, bw * a, sh / 2 - 3)
        ctx.fillStyle = B_COL
        ctx.fillRect(fx, ty + sh / 2 + 1, bw * b, sh / 2 - 3)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(fx + bw * (a + (b - a) * xf) - RES, ty + 1, 2 * RES, sh - 2)
      })
    }
  })

  const where = (e: { clientX: number; clientY: number }, r: DOMRect) => ({ fx: ((e.clientX - r.left) / r.width) * W, fy: ((e.clientY - r.top) / r.height) * H })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const { fx, fy } = where(e, r)
    const p = live()
    if (fy < gh) {
      const t = Math.min(DK_TRACKS - 1, Math.floor(fy / rh))
      if (fx < lw) {
        if (fy - t * rh < rh * 0.5) actions.setParam(mod, `snd${t}`, (Math.round(p[`snd${t}`] ?? 0) + (e.shiftKey ? DK_SOUNDS.length - 1 : 1)) % DK_SOUNDS.length)
        else actions.setParam(mod, `pm${t}`, 1 - Math.round(p[`pm${t}`] ?? 0))
        return
      }
      const i = Math.min(DK_STEPS - 1, Math.floor((fx - lw) / cw))
      actions.setParam(mod, `m${t}`, Math.round(p[`m${t}`] ?? 0) ^ (1 << i))
      return
    }
    if (fy < sy || fx < lw) return
    const t = Math.min(DK_TRACKS - 1, Math.floor((fy - sy) / sh))
    const fi = Math.min(DK_FIELDS.length - 1, Math.floor((fx - lw) / fw))
    const f = DK_FIELDS[fi]
    const id = dkId(fy - sy - t * sh < sh / 2 ? 'a' : 'b', t, f)
    const [lo, hi] = RANGE[f]
    const set = (cx: number) => {
      const px = ((cx - r.left) / r.width) * W
      const u = Math.max(0, Math.min(1, (px - (lw + fi * fw + 4 * RES)) / (fw - 8 * RES)))
      const v = lo + u * (hi - lo)
      actions.setParam(mod, id, f === 'pit' ? Math.round(v) : v)
    }
    set(e.clientX)
    track(
      (ev) => set(ev.clientX),
      () => {},
    )
  }

  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const { fx, fy } = where(e, e.currentTarget.getBoundingClientRect())
    if (fy >= gh || fx >= lw) return
    e.stopPropagation()
    const t = Math.min(DK_TRACKS - 1, Math.floor(fy / rh))
    const s = Math.round(live()[`snd${t}`] ?? 0)
    actions.setParam(mod, `snd${t}`, Math.max(0, Math.min(DK_OWN, s + (e.deltaY < 0 ? 1 : -1))))
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onWheel={wheel} />
}
