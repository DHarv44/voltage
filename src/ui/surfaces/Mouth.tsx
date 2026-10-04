import { useRef, type PointerEvent } from 'react'
import { TALK_VOWELS } from '../../modules/specs/talkbox'
import { actions } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, useFrame, type SurfaceProps } from './common'

/** Talk-box mouth: drag left-right for the vowel, up-down to open the jaw. */
export function Mouth({ inst, x, y, w, h }: SurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const { vowel, open } = params.current
    ctx.fillStyle = '#1b1416'
    ctx.fillRect(0, 0, W, H)
    // Lips: wide and flat for I, round and pursed for U; the jaw opens them.
    const cx = W / 2
    const cy = H * 0.48
    const rx = W * (0.16 + vowel * 0.22)
    const ry = H * (0.05 + open * 0.28) * (1.25 - vowel * 0.5)
    ctx.fillStyle = '#b84a5a'
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx * 1.25, ry + H * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2a0c12'
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    if (open > 0.35) {
      ctx.fillStyle = '#f1ece4'
      ctx.fillRect(cx - rx * 0.6, cy - ry, rx * 1.2, ry * 0.22)
      ctx.fillStyle = '#c95b6d'
      ctx.beginPath()
      ctx.ellipse(cx, cy + ry * 0.6, rx * 0.6, ry * 0.35, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(240,220,225,0.6)'
    ctx.font = `${Math.round(H * 0.1)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.textAlign = 'center'
    TALK_VOWELS.forEach((v, i) => {
      const near = Math.abs(vowel * (TALK_VOWELS.length - 1) - i) < 0.5
      ctx.fillStyle = near ? 'rgba(255,200,210,0.95)' : 'rgba(240,220,225,0.35)'
      ctx.fillText(v, W * (0.1 + (0.8 * i) / (TALK_VOWELS.length - 1)), H * 0.94)
    })
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const set = (cx: number, cy: number) =>
      actions.setParams(
        [
          [inst.id, 'vowel', Math.min(1, Math.max(0, (cx - r.left) / r.width))],
          [inst.id, 'open', Math.min(1, Math.max(0, 1 - (cy - r.top) / r.height))],
        ],
        `${inst.id}:mouth`,
      )
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
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'crosshair' }}
      onPointerDown={down}
    />
  )
}
