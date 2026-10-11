import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { HC_KEYS_HI, HC_KEYS_LO, HC_VOICES, HCL } from '../../modules/specs/halcyon'
import { PX } from '../geometry'
import { track } from '../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

const BLACK = new Set([1, 3, 6, 8, 10])
/** Where each black key sits across its white neighbours (fraction of a white key). */
const BLACK_AT: Record<number, number> = { 1: 0.62, 3: 0.78, 6: 0.6, 8: 0.7, 10: 0.82 }
const BLACK_H = 0.6
const BLACK_W = 0.6

/** HALCYON's keyboard: three octaves of keys to play with the mouse (drag
 *  along for a glissando); the keys light as the voices play them, from here,
 *  the computer keys, MIDI or the arpeggiator. */
export function HalcyonKeys({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const whites: number[] = []
  for (let n = HC_KEYS_LO; n <= HC_KEYS_HI; n++) if (!BLACK.has(n % 12)) whites.push(n)
  const ww = W / whites.length
  /** A black key's left edge (canvas px). */
  const blackX = (n: number) => (whites.indexOf(n - 1) + BLACK_AT[n % 12]) * ww

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const lit = new Set<number>()
    for (let v = 0; v < HC_VOICES; v++) {
      const n = led?.[HCL.voice0 + v] ?? -1
      if (n >= 0) lit.add(n)
    }
    ctx.fillStyle = '#0d0d0f'
    ctx.fillRect(0, 0, W, H)
    whites.forEach((n, i) => {
      ctx.fillStyle = lit.has(n) ? '#ffcf7a' : '#ece8dc'
      ctx.fillRect(i * ww + 1, 0, ww - 2, H - 2)
      if (n % 12 === 0) {
        ctx.fillStyle = '#8a8579'
        ctx.font = `${Math.round(ww * 0.32)}px Bahnschrift, 'Arial Narrow', sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(`C${n / 12 - 1}`, i * ww + ww / 2, H - ww * 0.3)
      }
    })
    for (let n = HC_KEYS_LO; n <= HC_KEYS_HI; n++) {
      if (!BLACK.has(n % 12)) continue
      ctx.fillStyle = lit.has(n) ? '#d08a2a' : '#1b1b1e'
      ctx.fillRect(blackX(n), 0, ww * BLACK_W, H * BLACK_H)
    }
  })

  const noteAt = (cx: number, cy: number, r: DOMRect) => {
    const fx = ((cx - r.left) / r.width) * W
    const fy = ((cy - r.top) / r.height) * H
    if (fy < H * BLACK_H)
      for (let n = HC_KEYS_LO; n <= HC_KEYS_HI; n++) if (BLACK.has(n % 12) && fx >= blackX(n) && fx < blackX(n) + ww * BLACK_W) return n
    return whites[Math.max(0, Math.min(whites.length - 1, Math.floor(fx / ww)))]
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    let last = noteAt(e.clientX, e.clientY, r)
    sendSurface(mod, 'halcyonkeys', last, 0, true)
    track(
      (ev) => {
        const n = noteAt(ev.clientX, ev.clientY, r)
        if (n !== last) {
          last = n
          sendSurface(mod, 'halcyonkeys', n, 0, true)
        }
      },
      () => sendSurface(mod, 'halcyonkeys', last, 0, false),
    )
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} />
}
