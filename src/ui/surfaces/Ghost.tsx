import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { GHOSTL } from '../../modules/specs/ghost'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const COLS = 160
const STATES = ['listening…', 'thinking…', 'answering']

/** Scrolling piano roll: your notes in white, GHOST's answers in cyan. */
export function Ghost({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const roll = useRef<[number, number][]>([])
  const frames = useRef(-1)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    if (led && telemetry.frames !== frames.current) {
      frames.current = telemetry.frames
      roll.current.push([led[GHOSTL.you], led[GHOSTL.ghost]])
      if (roll.current.length > COLS) roll.current.shift()
    }
    ctx.fillStyle = '#0b0c12'
    ctx.fillRect(0, 0, W, H)
    const cw = W / COLS
    const row = (n: number) => H * 0.5 - (n / 30) * H * 0.9
    roll.current.forEach(([you, ghost], i) => {
      if (you > -90) {
        ctx.fillStyle = '#e8e6f0'
        ctx.fillRect(i * cw, row(you) - 3, cw + 0.5, 6)
      }
      if (ghost > -90) {
        ctx.fillStyle = '#5ef2ff'
        ctx.fillRect(i * cw, row(ghost) - 3, cw + 0.5, 6)
      }
    })
    const st = led?.[GHOSTL.state] ?? 0
    ctx.fillStyle = st === 2 ? '#5ef2ff' : 'rgba(232,230,240,0.6)'
    ctx.font = `${Math.round(H * 0.08)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillText(STATES[st] ?? '', W * 0.03, H * 0.12)
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
