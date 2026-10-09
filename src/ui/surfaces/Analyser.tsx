import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { ANAL } from '../../modules/specs/meters'
import { PX } from '../geometry'
import { fitFont, RES, sendSurface, useFrame, type SurfaceProps } from './common'
import { fft } from './fft'

const N = 4096
const FS = 48000
const LO = 20
const HI = 20000
const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
/** The spectrum takes this much of the width; the meters the rest. */
const SPLIT = 0.72
const GRID_HZ = [50, 100, 200, 500, 1000, 2000, 5000, 10000]
const fmt = (v: number) => (v <= -98 ? '—' : v.toFixed(1))

/** ANALYSER's screen. Left: the spectrum (log frequency, TILT dB per octave
 *  so a balanced mix looks level), falling slowly, with a peak line. Right:
 *  loudness (M, S, I in LUFS; the bar is short-term against TARGET), peaks,
 *  and correlation along the bottom. Click to restart the integrated reading. */
export function Analyser({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params
  const st = useRef({ frames: -1, re: new Float32Array(N), im: new Float32Array(N), level: new Float32Array(512), peak: new Float32Array(512) })

  useFrame(ref, (_now, dt) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const s = st.current
    const p = params.current
    const range = p.range ?? 70
    const tilt = p.tilt ?? 3
    const SW = Math.round(W * SPLIT)
    const cols = Math.min(512, Math.round(SW / 3))
    const f = telemetry.scopes[mod]
    if (f && f.length === N && telemetry.frames !== s.frames) {
      s.frames = telemetry.frames
      for (let i = 0; i < N; i++) {
        s.re[i] = (f[i] / 5) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))
        s.im[i] = 0
      }
      fft(s.re, s.im)
      for (let c = 0; c < cols; c++) {
        // each column: the loudest bin in its slice of the log scale
        const f0 = LO * Math.pow(HI / LO, c / cols)
        const f1 = LO * Math.pow(HI / LO, (c + 1) / cols)
        const b0 = Math.max(1, Math.floor((f0 / FS) * N))
        const b1 = Math.max(b0, Math.min(N / 2 - 1, Math.floor((f1 / FS) * N)))
        let m = 0
        for (let b = b0; b <= b1; b++) m = Math.max(m, Math.hypot(s.re[b], s.im[b]))
        const db = 20 * Math.log10(m / (N / 4) + 1e-9) + tilt * Math.log2(Math.sqrt(f0 * f1) / 1000)
        s.level[c] = Math.max(db, s.level[c] - 40 * dt * 2)
        s.peak[c] = Math.max(db, s.peak[c] - 6 * dt * 2)
      }
    }
    ctx.fillStyle = '#07090b'
    ctx.fillRect(0, 0, W, H)
    const yOf = (db: number) => H * 0.94 * Math.min(1, Math.max(0, -db / range)) + H * 0.02

    // grid
    ctx.strokeStyle = 'rgba(120,160,190,0.15)'
    ctx.fillStyle = 'rgba(150,180,200,0.6)'
    ctx.lineWidth = 1
    ctx.font = `${Math.round(H * 0.045)}px ${FONT}`
    ctx.textAlign = 'center'
    for (const hz of GRID_HZ) {
      const gx = (Math.log(hz / LO) / Math.log(HI / LO)) * SW
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, H)
      ctx.stroke()
      ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : String(hz), gx, H * 0.985)
    }
    for (let d = 0; d < range; d += 10) {
      ctx.beginPath()
      ctx.moveTo(0, yOf(-d))
      ctx.lineTo(SW, yOf(-d))
      ctx.stroke()
    }

    // spectrum and its peak line
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(255,120,80,0.85)')
    grad.addColorStop(0.5, 'rgba(90,200,255,0.6)')
    grad.addColorStop(1, 'rgba(40,90,160,0.3)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (let c = 0; c < cols; c++) ctx.lineTo(((c + 0.5) / cols) * SW, yOf(s.level[c]))
    ctx.lineTo(SW, H)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,230,160,0.7)'
    ctx.beginPath()
    for (let c = 0; c < cols; c++) ctx[c ? 'lineTo' : 'moveTo'](((c + 0.5) / cols) * SW, yOf(s.peak[c]))
    ctx.stroke()

    // loudness, peaks, correlation
    const led = telemetry.leds[mod]
    const m = led?.[ANAL.m] ?? -99
    const sh = led?.[ANAL.s] ?? -99
    const i = led?.[ANAL.i] ?? -99
    const target = p.target ?? -14
    const mx = SW + (W - SW) * 0.08
    const mw = (W - SW) * 0.84
    ctx.fillStyle = '#0f1316'
    ctx.fillRect(SW, 0, W - SW, H)
    ctx.textAlign = 'left'
    // every line shrinks to fit the column
    const text = (t: string, ty: number, size: number, color: string, weight = '') => {
      ctx.fillStyle = color
      fitFont(ctx, t, mw, H * size, FONT, weight)
      ctx.fillText(t, mx, ty)
    }
    text(`M ${fmt(m)}  S ${fmt(sh)}`, H * 0.1, 0.06, '#8fa3b0')
    text(fmt(i), H * 0.27, 0.15, i > -98 && Math.abs(i - target) <= 1 ? '#6dff8f' : '#eef3f6', '600')
    text(`LUFS (I) · target ${target}`, H * 0.34, 0.05, '#8fa3b0')
    // short-term bar from −40 to 0 LUFS, the target marked
    const bx = (v: number) => mx + mw * Math.min(1, Math.max(0, (v + 40) / 40))
    ctx.fillStyle = '#1c2328'
    ctx.fillRect(mx, H * 0.39, mw, H * 0.06)
    ctx.fillStyle = sh > target + 1 ? '#ff8a4a' : '#5ac8ff'
    ctx.fillRect(mx, H * 0.39, bx(sh) - mx, H * 0.06)
    ctx.fillStyle = '#6dff8f'
    ctx.fillRect(bx(target) - 1.5, H * 0.37, 3, H * 0.1)
    const pk = Math.max(led?.[ANAL.pl] ?? -99, led?.[ANAL.pr] ?? -99)
    const top = led?.[ANAL.max] ?? -99
    text(`PEAK ${fmt(pk)} dB`, H * 0.58, 0.055, '#8fa3b0')
    text(`MAX ${fmt(top)} dB`, H * 0.67, 0.055, top > -0.1 ? '#ff5a4a' : '#8fa3b0')
    // correlation: −1 (out of phase) … +1 (mono)
    const corr = led?.[ANAL.corr] ?? 0
    text('CORRELATION', H * 0.8, 0.055, '#8fa3b0')
    ctx.fillStyle = '#1c2328'
    ctx.fillRect(mx, H * 0.84, mw, H * 0.05)
    ctx.fillStyle = corr < 0 ? '#ff5a4a' : '#6dff8f'
    const cx0 = mx + mw / 2
    ctx.fillRect(Math.min(cx0, cx0 + (corr * mw) / 2), H * 0.84, Math.abs((corr * mw) / 2), H * 0.05)
    ctx.fillStyle = '#eef3f6'
    ctx.fillRect(cx0 - 1, H * 0.83, 2, H * 0.07)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    sendSurface(mod, 'reset', 0, 0, true)
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} title="Click to restart the integrated loudness" style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} />
}
