import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { PROGL } from '../../modules/specs/progression'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const MINOR = ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'vii°']
const BORROWED = ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']

/** Roman-numeral history of the progression; the newest chord is brightest. */
export function Progression({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const minor = useRef(false)
  minor.current = inst.params.mode >= 0.5

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    ctx.fillStyle = '#1c1a17'
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'
    for (let i = 0; i < PROGL.count; i++) {
      const code = led?.[PROGL.history + i] ?? -1
      if (code < 0) continue
      const d = code % 8
      const seventh = (code & 8) !== 0
      const borrowed = (code & 16) !== 0
      const names = borrowed ? BORROWED : minor.current ? MINOR : MAJOR
      const a = 0.25 + (0.75 * (i + 1)) / PROGL.count
      ctx.fillStyle = borrowed ? `rgba(255,170,120,${a})` : `rgba(240,230,210,${a})`
      ctx.font = `600 ${Math.round(H * (i === PROGL.count - 1 ? 0.5 : 0.36))}px Georgia, serif`
      ctx.fillText(names[d] + (seventh ? '⁷' : ''), (W * (i + 0.5)) / PROGL.count, H * 0.66)
    }
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
