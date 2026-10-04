const TAU = Math.PI * 2
/** Strobe rows: 180 dots stand still at 33⅓ rpm under 100 Hz mains light, 133⅓ at 45. */
const STROBE = [
  { dots: 180, r: 0.985 },
  { dots: 133.333, r: 0.955 },
]
const FLASH_HZ = 100

export interface PlatterView {
  /** Platter angle in revolutions (unwrapped). */
  angle: number
  /** Needle across the record 0..1 (outer → inner). */
  pos: number
  held: boolean
  motor: boolean
  rec: boolean
  pressing: boolean
  accent: string
}

/** Direct-drive deck seen from above: strobe rim, record with grooves and a
 *  fixed specular shine (the light doesn't turn with the vinyl), spinning
 *  label with a cue sticker, and a tonearm whose needle rides the groove. */
export function paintPlatter(ctx: CanvasRenderingContext2D, W: number, H: number, v: PlatterView, now: number): void {
  const cx = W * 0.47
  const cy = H * 0.52
  const R = Math.min(W, H) * 0.46
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#1b1c1f'
  ctx.fillRect(0, 0, W, H)

  // Platter rim and strobe dots (stationary only at exactly the right speed).
  ctx.fillStyle = '#9a9ea3'
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, TAU)
  ctx.fill()
  for (const row of STROBE) {
    const phase = v.angle * row.dots - FLASH_HZ * now
    const off = phase - Math.floor(phase)
    ctx.fillStyle = '#2b2d30'
    const n = Math.round(row.dots)
    for (let k = 0; k < n; k++) {
      const a = ((k + off) / row.dots) * TAU
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * R * row.r, cy + Math.sin(a) * R * row.r, R * 0.008, 0, TAU)
      ctx.fill()
    }
  }

  // Slipmat edge and record.
  const rr = R * 0.92
  ctx.fillStyle = '#0b0b0c'
  ctx.beginPath()
  ctx.arc(cx, cy, rr, 0, TAU)
  ctx.fill()
  ctx.lineWidth = 1
  for (let g = 0.36; g < 0.985; g += 0.018) {
    ctx.strokeStyle = g > 0.9 || (g > 0.5 && g < 0.53) ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)'
    ctx.beginPath()
    ctx.arc(cx, cy, rr * g, 0, TAU)
    ctx.stroke()
  }
  // Specular shine: fixed to the room light.
  for (const a of [-0.9, 2.25]) {
    const grad = ctx.createConicGradient(a, cx, cy)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.04, 'rgba(255,255,255,0.09)')
    grad.addColorStop(0.08, 'rgba(255,255,255,0)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, rr * 0.985, 0, TAU)
    ctx.arc(cx, cy, rr * 0.34, 0, TAU, true)
    ctx.fill()
  }

  // Spinning label with a white cue sticker.
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(v.angle * TAU)
  ctx.fillStyle = v.accent
  ctx.beginPath()
  ctx.arc(0, 0, rr * 0.33, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.arc(0, 0, rr * 0.33, 0, TAU)
  ctx.arc(0, 0, rr * 0.29, 0, TAU, true)
  ctx.fill()
  ctx.fillStyle = '#f2ede2'
  ctx.font = `600 ${Math.round(rr * 0.07)}px Bahnschrift, 'Arial Narrow', sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('VOLTAGE', 0, -rr * 0.13)
  ctx.font = `${Math.round(rr * 0.045)}px Bahnschrift, 'Arial Narrow', sans-serif`
  ctx.fillText(v.pressing ? 'PRESSING…' : 'BATTLE RECORD · 33⅓', 0, rr * 0.18)
  ctx.fillStyle = '#fff'
  ctx.fillRect(rr * 0.36, -rr * 0.012, rr * 0.5, rr * 0.024)
  ctx.restore()
  ctx.fillStyle = '#c9ccd0'
  ctx.beginPath()
  ctx.arc(cx, cy, rr * 0.022, 0, TAU)
  ctx.fill()

  if (v.held) {
    ctx.strokeStyle = 'rgba(255,210,120,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, rr * 0.99, 0, TAU)
    ctx.stroke()
  }

  // Tonearm: pivot top-right; the stylus sits on the groove radius for `pos`.
  const px = W * 0.95
  const py = H * 0.1
  const L = Math.hypot(px - cx, py - cy) * 0.93
  const gr = rr * (0.97 - v.pos * 0.6)
  const d = Math.hypot(px - cx, py - cy)
  const a = (d * d + gr * gr - L * L) / (2 * d)
  const h = Math.sqrt(Math.max(0, gr * gr - a * a))
  const ux = (px - cx) / d
  const uy = (py - cy) / d
  const sx = cx + ux * a - uy * h
  const sy = cy + uy * a + ux * h
  ctx.strokeStyle = '#d7dade'
  ctx.lineWidth = Math.max(2, W * 0.012)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(sx, sy)
  ctx.stroke()
  ctx.fillStyle = '#2e3033'
  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(Math.atan2(sy - py, sx - px))
  ctx.fillRect(-W * 0.012, -W * 0.02, W * 0.06, W * 0.04)
  ctx.restore()
  ctx.fillStyle = '#5b5f64'
  ctx.beginPath()
  ctx.arc(px, py, W * 0.035, 0, TAU)
  ctx.fill()

  if (v.rec) {
    ctx.strokeStyle = 'rgba(255,60,50,0.9)'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, W - 4, H - 4)
  }
}
