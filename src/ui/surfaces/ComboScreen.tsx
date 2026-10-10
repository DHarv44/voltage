import { useRef } from 'react'
import { telemetry } from '../../audio/telemetry'
import { chordName } from '../../modules/specs/combo/chords'
import { GENRES, styleOf } from '../../modules/specs/combo/genres'
import { CL, COMBO_PARTS, LEARN_FAILS } from '../../modules/specs/combo/params'
import { patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { RES, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const INK = '#f1e7d0'
const DIM = 'rgba(241,231,208,0.4)'
const GREEN = '#5ef27a'
const AMBER = '#ffb347'
const RED = '#ff4a3a'

/** COMBO's screen: what it's doing (listening, playing, why it couldn't
 *  learn), the five parts (learned, playing, cued, high intensity), the
 *  chord and where we are in the part, the genre and style with the style
 *  suggestions (green: meter and feel match how you played; amber: meter). */
export function ComboScreen({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
    const L = telemetry.leds[mod]
    const at = (i: number, d = 0) => L?.[i] ?? d
    ctx.fillStyle = '#121416'
    ctx.fillRect(0, 0, W, H)
    ctx.textBaseline = 'middle'
    const status = at(CL.status)
    const u = H / 10

    // top line: what it's doing
    ctx.font = `700 ${Math.round(u * 1.3)}px ${FONT}`
    ctx.textAlign = 'left'
    const blink = Math.floor(now / 300) % 2 === 0
    if (status === 1) {
      ctx.fillStyle = blink ? RED : '#7a2a22'
      ctx.fillText(`● LISTENING  ${at(CL.learnT).toFixed(1)} s`, u * 0.6, u * 1.1)
    } else if (status === 3) {
      ctx.fillStyle = RED
      ctx.fillText(`COULDN’T LEARN: ${LEARN_FAILS[at(CL.why)] ?? '?'}`, u * 0.6, u * 1.1)
    } else {
      ctx.fillStyle = status === 2 ? GREEN : DIM
      const beats = at(CL.beats)
      const meter = at(CL.meter, 4)
      const pos = at(CL.beat)
      const where = status === 2 && beats ? `BAR ${Math.floor(pos / meter) + 1}.${Math.floor(pos % meter) + 1}` : beats ? 'READY: PRESS BAND' : 'PRESS BAND, PLAY A PART, PRESS BAND'
      ctx.fillText(status === 2 ? `▶ ${where}` : where, u * 0.6, u * 1.1)
    }
    ctx.textAlign = 'right'
    ctx.fillStyle = INK
    ctx.fillText(status === 2 ? `${Math.round(at(CL.bpm))} BPM` : '', W - u * 0.6, u * 1.1)

    // the chord, big
    ctx.textAlign = 'left'
    ctx.font = `700 ${Math.round(u * 3)}px ${FONT}`
    ctx.fillStyle = status === 2 ? INK : DIM
    ctx.fillText(status === 2 ? chordName(at(CL.chord, -1)) : '–', u * 0.6, u * 3.6)

    // the parts
    const playing = status === 2 ? at(CL.part) : -1
    const cued = at(CL.cued, -1)
    const sel = at(CL.sel)
    const pw = (W * 0.5) / COMBO_PARTS
    for (let i = 0; i < COMBO_PARTS; i++) {
      const px = W * 0.46 + i * pw
      const state = at(CL.parts + i)
      ctx.fillStyle = i === playing ? (state === 2 ? RED : GREEN) : i === cued && blink ? AMBER : state ? '#2b3a2e' : '#22252a'
      ctx.fillRect(px + 2, u * 2.4, pw - 4, u * 2.4)
      if (i === sel) {
        ctx.strokeStyle = INK
        ctx.lineWidth = Math.max(1, u * 0.12)
        ctx.strokeRect(px + 2, u * 2.4, pw - 4, u * 2.4)
      }
      ctx.fillStyle = i === playing ? '#0c0d0f' : state ? INK : DIM
      ctx.textAlign = 'center'
      ctx.font = `700 ${Math.round(u * 1.2)}px ${FONT}`
      ctx.fillText(String(i + 1), px + pw / 2, u * 3.6)
    }

    // genre, style, and the style suggestions
    const g = Math.round(p.genre ?? 2)
    const s = Math.round(p.style ?? 0)
    const st = styleOf(g, s)
    ctx.textAlign = 'left'
    ctx.font = `600 ${Math.round(u * 1.15)}px ${FONT}`
    ctx.fillStyle = INK
    ctx.fillText(`${GENRES[g]?.name ?? ''} · ${s + 1} ${st.name}`, u * 0.6, u * 6.2)
    ctx.fillStyle = DIM
    ctx.font = `600 ${Math.round(u * 0.9)}px ${FONT}`
    ctx.fillText(`${st.sub === 3 ? '12/8' : `${st.beats}/4`}${st.swing > 0.15 || st.swing16 > 0.15 ? ' · SWING' : ''}`, u * 0.6, u * 7.4)
    const dw = (W - u * 1.2) / 12
    for (let k = 0; k < 12; k++) {
      const hint = at(CL.hints + k)
      ctx.beginPath()
      ctx.arc(u * 0.6 + dw * (k + 0.5), u * 8.9, Math.min(dw * 0.3, u * 0.55) * (k === s ? 1.35 : 1), 0, Math.PI * 2)
      ctx.fillStyle = hint === 2 ? GREEN : hint === 1 ? AMBER : '#2c2f34'
      ctx.globalAlpha = k === s ? 1 : 0.75
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, pointerEvents: 'none' }} />
}
