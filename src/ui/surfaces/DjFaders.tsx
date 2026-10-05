import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { actions } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'

/** Fader tracks as fractions of the surface. */
const CH_X = [0.28, 0.72]
const CH_TOP = 0.06
const CH_BOT = 0.7
const XF_Y = 0.86
const XF_L = 0.12
const XF_R = 0.88

/** Channel up-faders with level meters, and the crossfader. Drag to move. */
export function DjFaders({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = params.current
    const led = telemetry.leds[mod]
    ctx.fillStyle = '#18191b'
    ctx.fillRect(0, 0, W, H)
    const cap = (cx: number, cy: number, horiz: boolean) => {
      ctx.fillStyle = '#d9dcdf'
      const fw = horiz ? W * 0.06 : W * 0.16
      const fh = horiz ? H * 0.11 : H * 0.05
      ctx.beginPath()
      ctx.roundRect(cx - fw / 2, cy - fh / 2, fw, fh, 3)
      ctx.fill()
      ctx.fillStyle = '#222'
      if (horiz) ctx.fillRect(cx - 1, cy - fh / 2, 2, fh)
      else ctx.fillRect(cx - fw / 2, cy - 1, fw, 2)
    }
    ;['a', 'b'].forEach((c, i) => {
      const cx = CH_X[i] * W
      ctx.fillStyle = '#050505'
      ctx.fillRect(cx - 2, CH_TOP * H, 4, (CH_BOT - CH_TOP) * H)
      // meter beside the fader: 10 segments
      const lvl = led?.[i] ?? 0
      for (let s = 0; s < 10; s++) {
        const on = lvl * 10 > s
        ctx.fillStyle = on ? (s > 7 ? '#ff4a3a' : s > 5 ? '#ffd25a' : '#3bff6b') : '#2a2b2e'
        const sy = CH_BOT * H - ((s + 1) / 10) * (CH_BOT - CH_TOP) * H
        ctx.fillRect(cx + (i === 0 ? -W * 0.14 : W * 0.11), sy + 2, W * 0.03, (CH_BOT - CH_TOP) * H * 0.08)
      }
      cap(cx, (CH_BOT - (CH_BOT - CH_TOP) * p[`${c}fader`]) * H, false)
      ctx.fillStyle = 'rgba(230,230,225,0.6)'
      ctx.font = `${Math.round(H * 0.04)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(c.toUpperCase(), cx, CH_BOT * H + H * 0.06)
    })
    ctx.fillStyle = '#050505'
    ctx.fillRect(XF_L * W, XF_Y * H - 2, (XF_R - XF_L) * W, 4)
    cap((XF_L + (XF_R - XF_L) * p.xfade) * W, XF_Y * H, true)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    let param: string
    if (fy > CH_BOT + 0.06) param = 'xfade'
    else if (Math.abs(fx - CH_X[0]) < 0.14) param = 'afader'
    else if (Math.abs(fx - CH_X[1]) < 0.14) param = 'bfader'
    else return
    e.stopPropagation()
    e.preventDefault()
    const set = (cx: number, cy: number) => {
      const v =
        param === 'xfade'
          ? ((cx - r.left) / r.width - XF_L) / (XF_R - XF_L)
          : (CH_BOT - (cy - r.top) / r.height) / (CH_BOT - CH_TOP)
      actions.setParam(inst.id, param, Math.min(1, Math.max(0, v)))
    }
    set(e.clientX, e.clientY)
    track(
      (ev) => set(ev.clientX, ev.clientY),
      () => {},
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
      onPointerDown={down}
    />
  )
}
