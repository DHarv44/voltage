import { useEffect, useRef, useSyncExternalStore, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { cameraInput } from '../../audio/inputs/camera'
import { gamepadInput, PAD_BUTTONS } from '../../audio/inputs/gamepad'
import { micInput, type InputStatus } from '../../audio/inputs/mic'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const STATUS: Record<InputStatus, string> = {
  off: 'click to ENABLE',
  asking: 'asking permission…',
  on: 'live',
  denied: 'permission denied',
  error: 'unavailable (power on first?)',
}
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

const label = (ctx: CanvasRenderingContext2D, text: string, W: number, H: number, y: number, size = 0.13) => {
  ctx.fillStyle = 'rgba(230,235,240,0.75)'
  ctx.font = `${Math.round(H * size)}px Bahnschrift, 'Arial Narrow', sans-serif`
  ctx.fillText(text, W * 0.05, H * y)
}

/** AUDIO IN: status, level meter and the tracked note. Click to enable/disable. */
export function AudioIn({ inst, x, y, w, h }: SurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const status = useSyncExternalStore((f) => micInput.subscribe(f), () => micInput.status)
  const st = useRef(status)
  st.current = status
  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[inst.id]
    ctx.fillStyle = '#121416'
    ctx.fillRect(0, 0, W, H)
    label(ctx, STATUS[st.current], W, H, 0.28)
    const lvl = led?.[0] ?? 0
    ctx.fillStyle = lvl > 0.9 ? '#ff4a3a' : '#3bff6b'
    ctx.fillRect(W * 0.05, H * 0.42, W * 0.9 * lvl, H * 0.14)
    if ((led?.[1] ?? 0) > 0.5) {
      const s = Math.round((led?.[2] ?? 0) * 12)
      label(ctx, `${NAMES[((s % 12) + 12) % 12]}${Math.floor(s / 12) + 4}`, W, H, 0.88, 0.26)
    }
  })
  const click = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (st.current === 'on') micInput.disable()
    else void micInput.enable()
  }
  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }} onPointerDown={click} />
}

/** CAMERA: live mirrored preview with the motion centre. Click to enable/disable. */
export function Camera({ inst, x, y, w, h }: SurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const status = useSyncExternalStore((f) => cameraInput.subscribe(f), () => cameraInput.status)
  useEffect(() => cameraInput.register(inst.id), [inst.id])
  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0c0d10'
    ctx.fillRect(0, 0, W, H)
    if (cameraInput.status === 'on') {
      ctx.save()
      ctx.scale(-1, 1) // a mirror, so it moves the way you do
      ctx.globalAlpha = 0.75
      ctx.drawImage(cameraInput.video, -W, 0, W, H)
      ctx.restore()
      const m = cameraInput.motion
      ctx.strokeStyle = `rgba(94,242,255,${0.3 + m * 0.7})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cameraInput.cx * W, (1 - cameraInput.cy) * H, H * (0.06 + m * 0.2), 0, Math.PI * 2)
      ctx.stroke()
    } else label(ctx, STATUS[cameraInput.status], W, H, 0.55)
  })
  const click = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (status === 'on') cameraInput.disable()
    else void cameraInput.enable()
  }
  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }} onPointerDown={click} />
}

/** GAMEPAD: live view of sticks, triggers and buttons. */
export function Gamepad({ inst, x, y, w, h }: SurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  useEffect(() => gamepadInput.register(inst.id), [inst.id])
  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const s = gamepadInput.state
    ctx.fillStyle = '#121316'
    ctx.fillRect(0, 0, W, H)
    if (!s.connected) {
      label(ctx, 'press a button on your controller', W, H, 0.55, 0.11)
      return
    }
    const stick = (cx: number, ax: number, ay: number) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx * W, H * 0.5, H * 0.28, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#5ef2ff'
      ctx.beginPath()
      ctx.arc(cx * W + ax * H * 0.24, H * 0.5 + ay * H * 0.24, H * 0.08, 0, Math.PI * 2)
      ctx.fill()
    }
    stick(0.2, s.axes[0], s.axes[1])
    stick(0.8, s.axes[2], s.axes[3])
    s.triggers.forEach((t, i) => {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(W * (i ? 0.62 : 0.32), H * 0.06, W * 0.06, H * 0.2)
      ctx.fillStyle = '#ffd25a'
      ctx.fillRect(W * (i ? 0.62 : 0.32), H * 0.26 - H * 0.2 * t, W * 0.06, H * 0.2 * t)
    })
    PAD_BUTTONS.forEach((b, i) => {
      const bx = W * (0.36 + (i % 3) * 0.14)
      const by = H * (0.55 + Math.floor(i / 3) * 0.25)
      ctx.fillStyle = s.buttons[i] ? '#ff6a1a' : 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      ctx.arc(bx, by, H * 0.08, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#eee'
      ctx.font = `${Math.round(H * 0.08)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(b, bx, by + H * 0.03)
      ctx.textAlign = 'left'
    })
  })
  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, pointerEvents: 'none' }} />
}
