/** The melodic POCKETs' LCD mascots: the bass a speaker cone that pumps, the
 *  melody a little bird that sings, the arcade a pixel invader that hops, the
 *  robot a head whose antenna lights up. */

/** The LCD's own green (for cut-outs). */
const LCD = '#9fb08c'
const INVADER =['00100100', '00011000', '00111100', '01011010', '11111111', '10111101', '10100101', '00011000']

export function drawMascot(ctx: CanvasRenderingContext2D, kind: string, mx: number, my: number, lh: number, flash: number, ink: string): void {
  ctx.fillStyle = ink
  ctx.strokeStyle = ink
  if (kind === 'pocketbass') {
    ctx.beginPath()
    ctx.arc(mx, my, lh * (0.06 + flash * 0.03), 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(mx, my, lh * (0.11 + flash * 0.02), 0, Math.PI * 2)
    ctx.stroke()
  } else if (kind === 'pocketrobot') {
    // a square head, two eyes, an antenna whose light blinks on every note
    const s = lh * 0.09
    ctx.fillRect(mx - s, my - s * 0.7, s * 2, s * 1.6)
    ctx.fillStyle = LCD
    ctx.fillRect(mx - s * 0.6, my - s * 0.3, s * 0.4, s * 0.4)
    ctx.fillRect(mx + s * 0.2, my - s * 0.3, s * 0.4, s * 0.4)
    ctx.fillRect(mx - s * 0.5, my + s * 0.45, s, s * 0.15)
    ctx.fillStyle = ink
    ctx.fillRect(mx - s * 0.05, my - s * 1.3, s * 0.1, s * 0.6)
    ctx.beginPath()
    ctx.arc(mx, my - s * 1.4, s * (0.18 + flash * 0.2), 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'pocketspeak') {
    // a face whose mouth opens as it sings
    const r = lh * 0.1
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(mx, my, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillRect(mx - r * 0.45, my - r * 0.35, r * 0.18, r * 0.18)
    ctx.fillRect(mx + r * 0.27, my - r * 0.35, r * 0.18, r * 0.18)
    ctx.beginPath()
    ctx.ellipse(mx, my + r * 0.35, r * 0.35, r * (0.06 + flash * 0.3), 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'pocketarcade') {
    // hops a pixel on every note, arms up and down
    const px = lh * 0.022
    const top = my - px * 4 - (flash > 0.5 ? px * 1.5 : 0)
    INVADER.forEach((row, y) => {
      const r = flash > 0.5 && y === 7 ? '01000010' : row
      for (let x = 0; x < 8; x++) if (r[x] === '1') ctx.fillRect(mx - px * 4 + x * px, top + y * px, px, px)
    })
  } else {
    ctx.beginPath()
    ctx.ellipse(mx, my + lh * 0.02, lh * 0.08, lh * 0.06, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(mx + lh * 0.07, my - flash * lh * 0.03)
    ctx.lineTo(mx + lh * 0.14, my - lh * 0.01 - flash * lh * 0.05)
    ctx.lineTo(mx + lh * 0.07, my + lh * 0.03)
    ctx.fill()
    if (flash > 0.3) ctx.fillText('♪', mx + lh * 0.3, my - flash * lh * 0.06)
  }
}
