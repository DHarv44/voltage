import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../../audio/telemetry'
import { MZL } from '../../../modules/specs/metronomes'
import { actions, patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { track } from '../../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from '../common'
import { FONT } from './draw'

/** The notches on a Maelzel scale (the weight clicks into these). */
const MARKS = [40, 44, 48, 52, 56, 60, 63, 66, 69, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 126, 132, 138, 144, 152, 160, 168, 176, 184, 192, 200, 208]
const NAMES: [string, number][] = [
  ['Largo', 46],
  ['Adagio', 69],
  ['Andante', 88],
  ['Moderato', 112],
  ['Allegro', 138],
  ['Presto', 184],
]
const LO = Math.log(40)
const SPAN = Math.log(208) - LO

/** Where the weight sits on the rod (share of its length): slower is higher. */
const reach = (bpm: number) => 0.92 - 0.6 * ((Math.log(bpm) - LO) / SPAN)
const bpmAt = (r: number) => Math.exp(LO + ((0.92 - r) / 0.6) * SPAN)
const notch = (bpm: number) => MARKS.reduce((m, k) => (Math.abs(k - bpm) < Math.abs(m - bpm) ? k : m), MARKS[0])

/** MAELZEL's face: the wooden case with its tempo scale, the rod swinging
 *  from the engine's pendulum, the sliding weight (drag it up or down: it
 *  clicks into the scale's notches), the winding key with its spring gauge
 *  (click to wind), the bell. TILT leans the whole case. */
export function Maelzel({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const keyTurn = useRef(0)
  const geo = () => {
    const px = W / 2
    const py = H * 0.9
    return { px, py, L: H * 0.82, key: { x: W * 0.9, y: H * 0.74, r: H * 0.08 } }
  }

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
    const led = telemetry.leds[mod]
    const theta = led?.[MZL.angle] ?? 0
    const { px, py, L, key } = geo()
    ctx.fillStyle = '#2a2019'
    ctx.fillRect(0, 0, W, H)

    ctx.save()
    // off level: the whole case leans
    ctx.translate(px, H)
    ctx.rotate(p.tilt * 0.06)
    ctx.translate(-px, -H)
    // the case: a walnut pyramid
    const wood = ctx.createLinearGradient(px - W * 0.3, 0, px + W * 0.3, 0)
    wood.addColorStop(0, '#4a2c17')
    wood.addColorStop(0.5, '#7a4a26')
    wood.addColorStop(1, '#3d2412')
    ctx.fillStyle = wood
    ctx.beginPath()
    ctx.moveTo(px - W * 0.34, H * 0.99)
    ctx.lineTo(px - W * 0.08, H * 0.02)
    ctx.lineTo(px + W * 0.08, H * 0.02)
    ctx.lineTo(px + W * 0.34, H * 0.99)
    ctx.closePath()
    ctx.fill()
    // the ivory scale plate, with its notches and names
    ctx.fillStyle = '#efe4c8'
    ctx.beginPath()
    ctx.moveTo(px - W * 0.17, py - L * 0.26)
    ctx.lineTo(px - W * 0.1, H * 0.06)
    ctx.lineTo(px + W * 0.1, H * 0.06)
    ctx.lineTo(px + W * 0.17, py - L * 0.26)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#3a2a1c'
    ctx.textBaseline = 'middle'
    const big = [40, 60, 72, 96, 120, 144, 176, 208]
    MARKS.forEach((m) => {
      const yy = py - L * reach(m)
      ctx.fillRect(px - W * 0.015, yy - 0.5, W * 0.03, 1)
      if (!big.includes(m)) return
      ctx.textAlign = 'right'
      ctx.font = `600 ${Math.round(H * 0.045)}px ${FONT}`
      ctx.fillText(String(m), px - W * 0.025, yy)
    })
    ctx.textAlign = 'left'
    ctx.font = `italic 500 ${Math.round(H * 0.042)}px Georgia, serif`
    for (const [name, at] of NAMES) ctx.fillText(name, px + W * 0.025, py - L * reach(at))
    ctx.restore()

    // the rod and its weight
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(theta)
    ctx.strokeStyle = '#d6d9de'
    ctx.lineWidth = Math.max(2.5, H * 0.018)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, H * 0.02)
    ctx.lineTo(0, -L)
    ctx.stroke()
    const wy = -L * reach(p.bpm)
    const ww = H * 0.085
    const brass = ctx.createLinearGradient(-ww, 0, ww, 0)
    brass.addColorStop(0, '#8a6a22')
    brass.addColorStop(0.45, '#f0d27a')
    brass.addColorStop(1, '#7a5c1a')
    ctx.fillStyle = brass
    ctx.beginPath()
    ctx.moveTo(-ww, wy + ww * 0.6)
    ctx.lineTo(-ww * 0.6, wy - ww * 0.6)
    ctx.lineTo(ww * 0.6, wy - ww * 0.6)
    ctx.lineTo(ww, wy + ww * 0.6)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#5a4312'
    ctx.fillRect(-ww * 0.8, wy - 1, ww * 1.6, 2)
    ctx.restore()
    // the pivot housing
    ctx.fillStyle = '#1c130c'
    ctx.beginPath()
    ctx.arc(px, py, H * 0.045, 0, Math.PI * 2)
    ctx.fill()

    // the winding key and its spring gauge
    const wound = led?.[MZL.spring] ?? 1
    const electric = p.spring >= 0.5
    ctx.strokeStyle = 'rgba(239,228,200,0.18)'
    ctx.lineWidth = H * 0.018
    ctx.beginPath()
    ctx.arc(key.x, key.y, key.r * 1.35, Math.PI * 0.75, Math.PI * 2.25)
    ctx.stroke()
    ctx.strokeStyle = electric ? '#7fc3ff' : wound < 0.25 ? '#e8402f' : '#d4af37'
    ctx.beginPath()
    ctx.arc(key.x, key.y, key.r * 1.35, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * wound))
    ctx.stroke()
    ctx.save()
    ctx.translate(key.x, key.y)
    ctx.rotate(keyTurn.current)
    ctx.fillStyle = '#b8a27a'
    ctx.beginPath()
    ctx.ellipse(0, 0, key.r, key.r * 0.35, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = 'rgba(239,228,200,0.75)'
    ctx.textAlign = 'center'
    ctx.font = `600 ${Math.round(H * 0.05)}px ${FONT}`
    const blink = Math.floor(now / 400) % 2 === 0
    ctx.fillText(electric ? 'ELECTRIC' : wound <= 0 ? (blink ? 'WIND ME' : '') : 'WIND', key.x, key.y + key.r * 2.1)

    // the bell
    if (p.bell >= 0.5) {
      const glow = led?.[MZL.bell] ?? 0
      const bx = W * 0.12
      const by = H * 0.22
      const br = H * 0.07
      ctx.fillStyle = `rgba(212,175,55,${0.35 + 0.65 * glow})`
      ctx.beginPath()
      ctx.moveTo(bx - br, by + br * 0.8)
      ctx.quadraticCurveTo(bx - br * 0.8, by - br, bx, by - br)
      ctx.quadraticCurveTo(bx + br * 0.8, by - br, bx + br, by + br * 0.8)
      ctx.closePath()
      ctx.fill()
    }
    // the tempo
    ctx.fillStyle = 'rgba(239,228,200,0.85)'
    ctx.textAlign = 'left'
    ctx.font = `700 ${Math.round(H * 0.08)}px ${FONT}`
    ctx.fillText(`♩ = ${Math.round(p.bpm)}`, W * 0.04, H * 0.92)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const b = e.currentTarget.getBoundingClientRect()
    const fx = ((e.clientX - b.left) / b.width) * W
    const fy = ((e.clientY - b.top) / b.height) * H
    const { px, py, L, key } = geo()
    if (Math.hypot(fx - key.x, fy - key.y) < key.r * 1.6) {
      e.stopPropagation()
      keyTurn.current += Math.PI / 2
      sendSurface(mod, 'wind', 0, 0, true)
      return
    }
    // the weight: drag it along the rod (up = slower); it clicks into the notches
    const p = patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
    const theta = telemetry.leds[mod]?.[MZL.angle] ?? 0
    const r = reach(p.bpm) * L
    if (Math.hypot(fx - (px + r * Math.sin(theta)), fy - (py - r * Math.cos(theta))) > H * 0.12) return
    e.stopPropagation()
    e.preventDefault()
    track(
      (ev) => {
        const yy = ((ev.clientY - b.top) / b.height) * H
        const bpm = notch(bpmAt(Math.max(0.3, Math.min(0.94, (py - yy) / L))))
        actions.setParam(mod, 'bpm', bpm)
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
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'grab' }}
      onPointerDown={down}
    />
  )
}
