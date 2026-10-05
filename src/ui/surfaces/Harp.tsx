import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { HARP_STRINGS, HARPL } from '../../modules/specs/harp'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const L = 0.05
const R = 0.95
const stringX = (i: number) => L + ((R - L) * (i + 0.5)) / HARP_STRINGS
/** Neck height at string i: long bass strings on the left, short treble on the right. */
const top = (i: number) => 0.06 + (i / HARP_STRINGS) * 0.5 + Math.sin((i / HARP_STRINGS) * Math.PI) * -0.05

/** Harp strings. Drag across them for a glissando; click near one to pluck it. */
export function Harp({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const shake = useRef(new Float32Array(HARP_STRINGS))

  useFrame(ref, (now, dt) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const last = led?.[HARPL.string] ?? -1
    const flash = led?.[HARPL.flash] ?? 0
    const sh = shake.current
    for (let i = 0; i < HARP_STRINGS; i++) sh[i] = i === last ? Math.max(sh[i] * Math.exp(-dt * 3), flash) : sh[i] * Math.exp(-dt * 3)
    ctx.fillStyle = '#efe6d2'
    ctx.fillRect(0, 0, W, H)
    // Neck and soundboard.
    ctx.strokeStyle = '#7a4a22'
    ctx.lineWidth = H * 0.035
    ctx.beginPath()
    for (let i = 0; i < HARP_STRINGS; i++) {
      const px = stringX(i) * W
      const py = top(i) * H
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
    ctx.fillStyle = '#a8703a'
    ctx.fillRect(0, H * 0.9, W, H * 0.1)
    for (let i = 0; i < HARP_STRINGS; i++) {
      const px = stringX(i) * W
      const letter = i % 7
      ctx.strokeStyle = letter === 0 ? '#c2342a' : letter === 3 ? '#2a5ac2' : '#8c7c64'
      ctx.lineWidth = 1 + (1 - i / HARP_STRINGS) * 2
      const wob = sh[i] * W * 0.004 * Math.sin(now * 70 + i)
      ctx.beginPath()
      ctx.moveTo(px, top(i) * H)
      ctx.quadraticCurveTo(px + wob * 2, (top(i) * H + H * 0.9) / 2, px, H * 0.9)
      ctx.stroke()
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const idx = (cx: number) => ((cx - r.left) / r.width - L) / (R - L) * HARP_STRINGS - 0.5
    let pos = idx(e.clientX)
    const nearest = Math.round(pos)
    if (Math.abs(pos - nearest) < 0.4) sendSurface(mod, 'pluck', nearest, 0.9, true)
    track(
      (ev) => {
        // Every string between the last pointer position and this one sounds.
        const now = idx(ev.clientX)
        const a = Math.min(pos, now)
        const b = Math.max(pos, now)
        const order: number[] = []
        for (let i = Math.ceil(a); i <= Math.floor(b); i++) if (i >= 0 && i < HARP_STRINGS && i !== Math.round(pos)) order.push(i)
        if (now < pos) order.reverse()
        for (const i of order) sendSurface(mod, 'pluck', i, 0.75, true)
        pos = now
      },
      () => {},
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }}
      onPointerDown={down}
    />
  )
}
