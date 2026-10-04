import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { THL } from '../../modules/specs/theremin'
import { PX } from '../geometry'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
/** Rod position and loop height as fractions of the surface. */
const ROD_X = 0.9
const LOOP_Y = 0.86

/** Hand position → (pitch proximity, volume proximity). Right = nearer the rod
 *  (higher), down = nearer the loop (quieter). */
function handAt(fx: number, fy: number): [number, number] {
  const pitch = Math.min(1, Math.max(0, fx / ROD_X))
  const vol = Math.min(1, Math.max(0, fy / LOOP_Y))
  return [pitch, vol]
}

/** Theremin antennas. Hover to play: no click needed. */
export function Theremin({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const params = useRef(inst.params)
  params.current = inst.params

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const level = led?.[THL.level] ?? 0
    const volts = led?.[THL.volts] ?? 0
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#120c0b')
    g.addColorStop(1, '#231511')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // Octave guides: equal-pitch lines in the field (closer together near the rod).
    const { tune, range } = params.current
    ctx.font = `${Math.round(H * 0.035)}px Bahnschrift, 'Arial Narrow', sans-serif`
    for (let oct = Math.ceil(tune - 1); oct <= tune - 1 + range; oct++) {
      const prox = Math.pow((oct - (tune - 1)) / range, 1 / 1.5)
      const gx = prox * ROD_X * W
      ctx.fillStyle = 'rgba(255,200,150,0.12)'
      ctx.fillRect(gx, 0, 1.5, H * LOOP_Y)
      ctx.fillStyle = 'rgba(255,200,150,0.35)'
      ctx.fillText(`C${oct + 4}`, gx + 4, H * 0.06)
    }

    // Pitch rod (vertical) and volume loop (bottom).
    const rx = ROD_X * W
    const glow = 6 + level * 20
    ctx.shadowColor = `rgba(255,170,90,${0.25 + level * 0.6})`
    ctx.shadowBlur = glow
    ctx.strokeStyle = '#e4e6e9'
    ctx.lineWidth = W * 0.014
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(rx, H * 0.08)
    ctx.lineTo(rx, H * 0.97)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(W * 0.4, H * LOOP_Y, W * 0.34, H * 0.045, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0

    // The hand.
    const p = pointer.current
    if (p) {
      const r = H * (0.05 + level * 0.06)
      const hg = ctx.createRadialGradient(p.x * W, p.y * H, 0, p.x * W, p.y * H, r * 3)
      hg.addColorStop(0, `rgba(255,190,120,${0.3 + level * 0.6})`)
      hg.addColorStop(1, 'rgba(255,190,120,0)')
      ctx.fillStyle = hg
      ctx.fillRect(p.x * W - r * 3, p.y * H - r * 3, r * 6, r * 6)
    }

    // Note readout.
    const semis = Math.round(volts * 12)
    const cents = Math.round((volts * 12 - semis) * 100)
    const name = `${NAMES[((semis % 12) + 12) % 12]}${Math.floor(semis / 12) + 4}`
    ctx.fillStyle = `rgba(255,220,180,${0.35 + level * 0.65})`
    ctx.font = `600 ${Math.round(H * 0.075)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillText(level > 0.02 ? name : '—', W * 0.04, H * 0.16)
    ctx.font = `${Math.round(H * 0.04)}px Bahnschrift, 'Arial Narrow', sans-serif`
    if (level > 0.02) ctx.fillText(`${cents >= 0 ? '+' : ''}${cents}¢`, W * 0.04, H * 0.23)
    void now
  })

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    pointer.current = { x: fx, y: fy }
    const [pitch, vol] = handAt(fx, fy)
    sendSurface(mod, 'hand', pitch, vol, true)
  }
  const leave = () => {
    pointer.current = null
    sendSurface(mod, 'hand', 0, 1, false)
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'none' }}
      onPointerMove={move}
      onPointerLeave={leave}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}
