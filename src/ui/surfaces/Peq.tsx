import { useRef, type PointerEvent, type WheelEvent } from 'react'
import { coefDb, EQ_BANDS, eqCoefs } from '../../engine/dsp/eqMath'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'

const FS = 48000
const F_LO = 20
const F_HI = 20000
const DB = 18
const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const COLS = ['#ff9f43', '#4fc3f7', '#a5d6a7', '#f48fb1']
/** Each band's frequency, gain and Q params (shelves have a fixed Q). */
const BAND = [
  { f: 'lf', g: 'lg', q: '', lo: 30, hi: 600 },
  { f: 'm1f', g: 'm1g', q: 'm1q', lo: 80, hi: 4000 },
  { f: 'm2f', g: 'm2g', q: 'm2q', lo: 400, hi: 12000 },
  { f: 'hf', g: 'hg', q: '', lo: 1500, hi: 16000 },
]

/** EQ's screen: the response of all four bands together, each band's dot at
 *  its frequency and gain. Drag a dot; scroll on a bell for its Q. */
export function Peq({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const fx = (f: number) => (Math.log(f / F_LO) / Math.log(F_HI / F_LO)) * W
  const xf = (px: number) => F_LO * Math.pow(F_HI / F_LO, px / W)
  const dy = (db: number) => H / 2 - (db / DB) * (H / 2) * 0.9
  const yd = (py: number) => ((H / 2 - py) / ((H / 2) * 0.9)) * DB
  const coefs = useRef(Array.from({ length: EQ_BANDS }, () => new Float64Array(5)))

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    ctx.fillStyle = '#121416'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = RES
    for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
      ctx.beginPath()
      ctx.moveTo(fx(f), 0)
      ctx.lineTo(fx(f), H)
      ctx.stroke()
    }
    for (const d of [-12, -6, 0, 6, 12]) {
      ctx.strokeStyle = d === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'
      ctx.beginPath()
      ctx.moveTo(0, dy(d))
      ctx.lineTo(W, dy(d))
      ctx.stroke()
    }
    BAND.forEach((b, i) => eqCoefs(i, p[b.f], p[b.g], b.q ? p[b.q] : 0.7, FS, coefs.current[i]))
    ctx.beginPath()
    for (let px = 0; px <= W; px += 2) {
      const f = xf(px)
      let d = 0
      for (let i = 0; i < EQ_BANDS; i++) d += coefDb(coefs.current[i], f, FS)
      if (px === 0) ctx.moveTo(px, dy(d))
      else ctx.lineTo(px, dy(d))
    }
    ctx.strokeStyle = '#ffe08a'
    ctx.lineWidth = 2 * RES
    ctx.stroke()
    BAND.forEach((b, i) => {
      ctx.fillStyle = COLS[i]
      ctx.beginPath()
      ctx.arc(fx(p[b.f]), dy(p[b.g]), 4.5 * RES, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `${Math.round(H * 0.07)}px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('100', fx(100) + 2, H - 4)
    ctx.fillText('1k', fx(1000) + 2, H - 4)
    ctx.fillText('10k', fx(10000) + 2, H - 4)
  })

  const nearest = (px: number, py: number) => {
    const p = live()
    let best = 0
    let bd = Infinity
    BAND.forEach((b, i) => {
      const d = Math.hypot(fx(p[b.f]) - px, dy(p[b.g]) - py)
      if (d < bd) (bd = d), (best = i)
    })
    return best
  }

  const at = (e: { clientX: number; clientY: number }, r: DOMRect) => [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const [px, py] = at(e, r)
    const b = BAND[nearest(px, py)]
    const set = (cx: number, cy: number) => {
      const [qx, qy] = at({ clientX: cx, clientY: cy }, r)
      actions.setParams(
        [
          [mod, b.f, Math.max(b.lo, Math.min(b.hi, xf(qx)))],
          [mod, b.g, Math.max(-DB, Math.min(DB, yd(qy)))],
        ],
        `peq:${mod}:${b.f}`,
      )
    }
    set(e.clientX, e.clientY)
    track(
      (ev) => set(ev.clientX, ev.clientY),
      () => {},
    )
  }

  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const [px, py] = at(e, r)
    const b = BAND[nearest(px, py)]
    if (!b.q) return
    e.stopPropagation()
    const q = live()[b.q]
    actions.setParam(mod, b.q, Math.max(0.3, Math.min(8, q * (e.deltaY < 0 ? 1.15 : 1 / 1.15))))
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} onWheel={wheel} />
}
