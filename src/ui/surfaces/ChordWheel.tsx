import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { CWL, WHEEL_DIM, WHEEL_MAJOR, WHEEL_MINOR } from '../../modules/specs/chordwheel'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

/** Ring edges as fractions of the radius: outer (major), middle (minor),
 *  inner (diminished); inside HUB is the 7TH button. */
const EDGES = [1, 0.68, 0.45, 0.27]
const HUB = EDGES[3]
const RINGS = [WHEEL_MAJOR, WHEEL_MINOR, WHEEL_DIM]
/** Roman numerals of the lit key wedge: positions key−1, key, key+1. */
const NUMERALS = [
  ['IV', 'I', 'V'],
  ['ii', 'vi', 'iii'],
  ['', 'vii°', ''],
]
const SECTOR = Math.PI / 6
const FILL = [
  ['#2c4a6e', '#4a77a8', '#e8a33d'],
  ['#233c59', '#3d6590', '#e8a33d'],
  ['#1b2f46', '#335579', '#e8a33d'],
]

/** Which chord a point is on: ring 0–2 and position 0–11, the hub, or nothing. */
function hit(fx: number, fy: number): { ring: number; pos: number } | 'hub' | null {
  const dx = fx - 0.5
  const dy = fy - 0.5
  const r = Math.hypot(dx, dy) * 2
  if (r > 1) return null
  if (r < HUB) return 'hub'
  const ring = r > EDGES[1] ? 0 : r > EDGES[2] ? 1 : 2
  const a = Math.atan2(dy, dx) + Math.PI / 2
  const pos = ((Math.round(a / SECTOR) % 12) + 12) % 12
  return { ring, pos }
}

/** A circle-of-fifths chord wheel: hold a chord to play it, slide to change. */
export function ChordWheel({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const key = Math.round(led?.[CWL.key] ?? inst.params.key)
    const ring = led?.[CWL.ring] ?? -1
    const pos = led?.[CWL.pos] ?? -1
    const held = (led?.[CWL.held] ?? 0) > 0
    const seventh = (led?.[CWL.seventh] ?? 0) > 0
    const cx = W / 2
    const cy = H / 2
    const R = Math.min(W, H) / 2 - 2
    ctx.clearRect(0, 0, W, H)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let g = 0; g < 3; g++) {
      const ro = R * EDGES[g]
      const ri = R * EDGES[g + 1]
      for (let i = 0; i < 12; i++) {
        const off = ((i - key + 18) % 12) - 6 // −1, 0, +1 = the key's wedge
        const inKey = g === 2 ? off === 0 : Math.abs(off) <= 1
        const on = ring === g && pos === i
        const a0 = (i - 0.5) * SECTOR - Math.PI / 2
        const a1 = a0 + SECTOR
        ctx.beginPath()
        ctx.arc(cx, cy, ro, a0, a1)
        ctx.arc(cx, cy, ri, a1, a0, true)
        ctx.closePath()
        ctx.fillStyle = on ? (held ? '#ffb347' : '#b07a33') : FILL[g][inKey ? 1 : 0]
        ctx.fill()
        ctx.strokeStyle = '#0f1a26'
        ctx.lineWidth = 2
        ctx.stroke()
        const am = (a0 + a1) / 2
        const rm = (ro + ri) / 2
        const tx = cx + Math.cos(am) * rm
        const ty = cy + Math.sin(am) * rm
        const size = (ro - ri) * (g === 0 ? 0.5 : 0.42)
        ctx.fillStyle = on ? '#1b1206' : inKey ? '#ffffff' : '#c9d6e4'
        ctx.font = `600 ${Math.round(size)}px Bahnschrift, 'Arial Narrow', sans-serif`
        const label = RINGS[g][i]
        const numeral = inKey ? NUMERALS[g][off + 1] : ''
        ctx.fillText(label, tx, numeral ? ty - size * 0.3 : ty)
        if (numeral) {
          ctx.font = `${Math.round(size * 0.6)}px Georgia, serif`
          ctx.fillStyle = on ? '#1b1206' : '#ffd79a'
          ctx.fillText(numeral, tx, ty + size * 0.5)
        }
      }
    }

    // Hub: the 7TH toggle.
    ctx.beginPath()
    ctx.arc(cx, cy, R * HUB - 2, 0, Math.PI * 2)
    ctx.fillStyle = seventh ? '#e8a33d' : '#13202e'
    ctx.fill()
    ctx.fillStyle = seventh ? '#1b1206' : '#9fb6cc'
    ctx.font = `600 ${Math.round(R * 0.12)}px Bahnschrift, 'Arial Narrow', sans-serif`
    ctx.fillText('7TH', cx, cy)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const at = (cx: number, cy: number) => hit((cx - r.left) / r.width, (cy - r.top) / r.height)
    const first = at(e.clientX, e.clientY)
    if (!first) return // outside the wheel: let the panel drag
    e.stopPropagation()
    e.preventDefault()
    if (first === 'hub') {
      sendSurface(mod, 'seventh', 0, 0, true)
      return
    }
    let cur = first
    sendSurface(mod, 'chord', cur.pos, cur.ring, true)
    track(
      (ev) => {
        // slide to another chord without lifting (the gate stays open)
        const h2 = at(ev.clientX, ev.clientY)
        if (!h2 || h2 === 'hub' || (h2.ring === cur.ring && h2.pos === cur.pos)) return
        cur = h2
        sendSurface(mod, 'chord', cur.pos, cur.ring, true)
      },
      () => sendSurface(mod, 'chord', cur.pos, cur.ring, false),
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
