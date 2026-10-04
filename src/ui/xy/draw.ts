import { XYL } from '../../modules/specs/xy'
import { SCALES } from '../../engine/dsp/shapers'

export interface PadLook {
  scale: number
  range: number
  morph: boolean
  corners: boolean[]
}

/** Trail of recent dot positions (newest last). */
export type Trail = { x: number; y: number; t: number }[]

const TRAIL_S = 1.6

/** Dark glass surface: note zones for PITCH, crosshair, a glowing dot with a
 *  fading trail (amber live, green when the loop is playing back). */
export function paintPad(ctx: CanvasRenderingContext2D, W: number, H: number, led: number[] | undefined, trail: Trail, look: PadLook, now: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0d1116')
  g.addColorStop(1, '#06080b')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Note zones: one column per scale step, roots brighter.
  const scale = SCALES[look.scale] ?? SCALES[0]
  const count = look.range * scale.length + 1
  for (let i = 1; i < count; i++) {
    const x = (i / count) * W
    ctx.fillStyle = i % scale.length === 0 ? 'rgba(255,190,90,0.22)' : 'rgba(150,180,220,0.07)'
    ctx.fillRect(Math.round(x), 0, 1, H)
  }
  ctx.fillStyle = 'rgba(150,180,220,0.1)'
  ctx.fillRect(0, Math.round(H / 2), W, 1)

  if (look.morph) {
    const r = Math.min(W, H) * 0.5
    ;[
      [0, 0],
      [W, 0],
      [0, H],
      [W, H],
    ].forEach(([cx, cy], i) => {
      if (!look.corners[i]) return
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      rg.addColorStop(0, 'rgba(120,200,255,0.16)')
      rg.addColorStop(1, 'rgba(120,200,255,0)')
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, W, H)
    })
  }

  const playing = (led?.[XYL.play] ?? 0) > 0.5
  const recording = (led?.[XYL.rec] ?? 0) > 0.9
  const hue = playing ? '90,255,140' : '255,190,80'
  ctx.lineCap = 'round'
  for (let i = 1; i < trail.length; i++) {
    const a = 1 - (now - trail[i].t) / TRAIL_S
    if (a <= 0) continue
    ctx.strokeStyle = `rgba(${hue},${a * 0.55})`
    ctx.lineWidth = 2 + a * 5
    ctx.beginPath()
    ctx.moveTo(trail[i - 1].x * W, (1 - trail[i - 1].y) * H)
    ctx.lineTo(trail[i].x * W, (1 - trail[i].y) * H)
    ctx.stroke()
  }

  if (led) {
    const x = led[XYL.x] * W
    const y = (1 - led[XYL.y]) * H
    const held = led[XYL.gate] > 0.5
    const r = 7 + (held ? 5 * led[XYL.pres] + 3 : 0)
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5)
    glow.addColorStop(0, `rgba(${hue},${held ? 0.65 : 0.35})`)
    glow.addColorStop(1, `rgba(${hue},0)`)
    ctx.fillStyle = glow
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8)
    ctx.fillStyle = held ? '#fff6e0' : `rgb(${hue})`
    ctx.beginPath()
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2)
    ctx.fill()
  }

  if (recording) {
    ctx.strokeStyle = 'rgba(255,60,50,0.85)'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, W - 4, H - 4)
  }
  if (playing && led) {
    ctx.fillStyle = 'rgba(90,255,140,0.7)'
    ctx.fillRect(0, H - 4, W * led[XYL.pos], 4)
  }
}

export function pushTrail(trail: Trail, x: number, y: number, now: number): void {
  const last = trail[trail.length - 1]
  if (!last || Math.hypot(last.x - x, last.y - y) > 0.002) trail.push({ x, y, t: now })
  while (trail.length && now - trail[0].t > TRAIL_S) trail.shift()
}
