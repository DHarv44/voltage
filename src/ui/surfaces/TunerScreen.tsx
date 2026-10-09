import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { TUNERL } from '../../modules/specs/meters'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
/** Within this many cents counts as in tune (the needle's green). */
const IN_TUNE = 3
const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"

/** TUNER's screen: the note, a needle over ±50 cents and a strobe band that
 *  drifts the way the note is off (faster the further) and stops in tune. */
export function TunerScreen({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params
  const s = useRef({ needle: 0, strobe: 0, shown: 0 })

  useFrame(ref, (_now, dt) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const voiced = (led?.[TUNERL.voiced] ?? 0) > 0.5
    const cents = led?.[TUNERL.cents] ?? 0
    const note = Math.round(led?.[TUNERL.note] ?? 0)
    const hz = led?.[TUNERL.hz] ?? 0
    const st = s.current
    // the needle eases (a real one has weight); it sinks to the middle when nothing plays
    st.needle += ((voiced ? cents : 0) - st.needle) * Math.min(1, dt * 10)
    st.shown += ((voiced ? 1 : 0) - st.shown) * Math.min(1, dt * 4)
    if (voiced) st.strobe = (st.strobe + cents * dt * 0.02 + 1) % 1
    const good = voiced && Math.abs(cents) <= IN_TUNE
    ctx.fillStyle = '#0d0f10'
    ctx.fillRect(0, 0, W, H)

    // the note
    ctx.textAlign = 'center'
    ctx.fillStyle = good ? '#6dff8f' : voiced ? '#f2f0e8' : '#3a3d40'
    ctx.font = `600 ${Math.round(H * 0.24)}px ${FONT}`
    const name = hz > 0 ? `${NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}` : '–'
    ctx.fillText(name, W / 2, H * 0.27)
    ctx.font = `${Math.round(H * 0.07)}px ${FONT}`
    ctx.fillStyle = '#8a8d90'
    ctx.fillText(voiced ? `${cents >= 0 ? '+' : ''}${cents.toFixed(1)} ¢   ${hz.toFixed(1)} Hz` : `A4 = ${Math.round(params.current.ref ?? 440)} Hz`, W / 2, H * 0.38)

    // the strobe: still when in tune
    const by = H * 0.44
    const bh = H * 0.06
    const stripes = 16
    const sw = W / stripes
    ctx.fillStyle = '#16191b'
    ctx.fillRect(0, by, W, bh)
    ctx.fillStyle = `rgba(255,170,60,${0.15 + 0.75 * st.shown})`
    for (let i = -1; i <= stripes; i++) ctx.fillRect((i + st.strobe) * sw, by, sw / 2, bh)

    // the needle over ±50 cents
    const cx = W / 2
    const cy = H * 0.97
    const R = Math.min(W * 0.44, H * 0.44)
    const ang = (c: number) => -Math.PI / 2 + (c / 50) * 0.9
    ctx.lineWidth = Math.max(2, H * 0.012)
    for (let c = -50; c <= 50; c += 10) {
      const a = ang(c)
      ctx.strokeStyle = c === 0 ? '#6dff8f' : '#4a4d50'
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86)
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(109,255,143,0.35)'
    ctx.lineWidth = R * 0.06
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.93, ang(-IN_TUNE), ang(IN_TUNE))
    ctx.stroke()
    const a = ang(Math.max(-50, Math.min(50, st.needle)))
    ctx.strokeStyle = good ? '#6dff8f' : `rgba(255,120,60,${0.3 + 0.7 * st.shown})`
    ctx.lineWidth = Math.max(2, H * 0.014)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95)
    ctx.stroke()
  })

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, pointerEvents: 'none' }}
    />
  )
}
