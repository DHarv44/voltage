/** Drawing shared by the metronome screens. */

export const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"

/** A row of beat lights: beat 1 larger, the current one lit (`hollow` draws
 *  them as rings, for COACH's silent bars). */
export function drawBeats(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  beats: number,
  at: number,
  o: { on: string; off: string; hollow?: boolean; flash?: number },
): void {
  const pitch = r.w / beats
  const rad = Math.min(r.h * 0.42, pitch * 0.36)
  for (let b = 0; b < beats; b++) {
    const cx = r.x + pitch * (b + 0.5)
    const cy = r.y + r.h / 2
    const rr = b === 0 ? rad : rad * 0.72
    const lit = b === at
    ctx.beginPath()
    ctx.arc(cx, cy, rr, 0, Math.PI * 2)
    if (o.hollow) {
      ctx.strokeStyle = lit ? o.on : o.off
      ctx.lineWidth = Math.max(1.5, rr * 0.18)
      ctx.stroke()
    } else {
      ctx.fillStyle = lit ? o.on : o.off
      ctx.globalAlpha = lit ? 0.55 + 0.45 * (o.flash ?? 1) : 1
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }
}

/** Big tempo digits, centred at (cx, cy), with a small unit after them. */
export function drawTempo(ctx: CanvasRenderingContext2D, bpm: number, cx: number, cy: number, size: number, color: string, unit = 'BPM'): void {
  const text = bpm >= 100 || Number.isInteger(Math.round(bpm * 10) / 10) ? String(Math.round(bpm)) : bpm.toFixed(1)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.font = `700 ${Math.round(size)}px ${FONT}`
  ctx.fillText(text, cx, cy)
  const tw = ctx.measureText(text).width
  ctx.textAlign = 'left'
  ctx.font = `600 ${Math.round(size * 0.28)}px ${FONT}`
  ctx.globalAlpha = 0.6
  ctx.fillText(unit, cx + tw / 2 + size * 0.08, cy + size * 0.22)
  ctx.globalAlpha = 1
}
