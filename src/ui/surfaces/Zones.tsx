import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { ZN_EVERY, ZN_FACTORY, ZN_KEYS_HI, ZN_KEYS_LO, ZN_MAX_S, ZN_SOURCES, ZN_VOICES, ZNL } from '../../modules/specs/zones'
import { patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { fitFont, RES, sendSurface, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const HEAD = 0.14
const KEYS = 0.3
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK = new Set([1, 3, 6, 8, 10])
const LAYER_COL = ['#3f6f8f', '#5b9bd5', '#9cc7ef', '#d8ecff']
const name = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`

interface Map {
  lo: number
  every: number
  roots: number
  layers: number
  rr: number
}

/** ZONES's screen: the multisample's zones over the keyboard (a column per
 *  sampled note, its range around it; a row per velocity layer, loudest at
 *  the top), lit as they play. While AUTO runs: the plan, the take being
 *  recorded in red. Click or drag on the keyboard to play (lower on a key
 *  is louder). */
export function Zones({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = (): Record<string, number> => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const span = ZN_KEYS_HI - ZN_KEYS_LO + 1
  const kw = W / span
  const ky = H * (1 - KEYS)
  const hy = H * HEAD
  const nx = (n: number) => (n - ZN_KEYS_LO) * kw

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const led = telemetry.leds[mod]
    const state = led?.[ZNL.state] ?? 0
    const sampling = state === 1
    const own = Math.round(p.src ?? 0) === 1 && (p.mroots ?? 0) > 0
    const plan: Map = { lo: Math.round(p.lo ?? 36), every: ZN_EVERY[Math.round(p.every ?? 3)] ?? 6, roots: 1, layers: Math.round(p.layers ?? 2), rr: Math.round(p.rr ?? 1) }
    plan.roots = Math.max(1, Math.floor((Math.max(plan.lo, Math.round(p.hi ?? 84)) - plan.lo) / plan.every) + 1)
    const map: Map = sampling ? plan : own ? { lo: p.mlo, every: p.mevery, roots: p.mroots, layers: p.mlayers, rr: p.mrr } : ZN_FACTORY
    ctx.fillStyle = '#111214'
    ctx.fillRect(0, 0, W, H)
    // the header
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const title = sampling ? `AUTO: TAKE ${(led?.[ZNL.take] ?? 0) + 1} OF ${plan.roots * plan.layers * plan.rr}` : state === 2 ? `TOO LONG: OVER ${ZN_MAX_S} S OF TAKES` : own ? 'OWN' : ZN_SOURCES[0]
    ctx.fillStyle = sampling || state === 2 ? '#ff5a4a' : '#ece7da'
    fitFont(ctx, title, W * 0.45, hy * 0.6, FONT, '700')
    ctx.fillText(title, 6 * RES, hy / 2)
    const info = `${map.roots} NOTES × ${map.layers} LAYER${map.layers > 1 ? 'S' : ''} × ${map.rr} ROUND ROBIN`
    ctx.fillStyle = '#9aa0aa'
    ctx.textAlign = 'right'
    fitFont(ctx, info, W * 0.5, hy * 0.5, FONT, '600')
    ctx.fillText(info, W - 6 * RES, hy / 2)
    if (sampling) {
      ctx.fillStyle = '#ff3b2f'
      ctx.fillRect(0, hy - 3 * RES, W * (led?.[ZNL.progress] ?? 0), 2 * RES)
    }
    // the zones
    const playing = new Set<number>()
    for (let v = 0; v < ZN_VOICES; v++) {
      const z = led?.[ZNL.voice0 + v] ?? -1
      if (z >= 0) playing.add(z)
    }
    const take = led?.[ZNL.take] ?? -1
    const zh = (ky - hy - 4 * RES) / Math.max(1, map.layers)
    for (let l = 0; l < map.layers; l++) {
      const zy = hy + 2 * RES + (map.layers - 1 - l) * zh
      for (let r = 0; r < map.roots; r++) {
        const root = map.lo + r * map.every
        const a = r === 0 ? ZN_KEYS_LO : root - map.every / 2
        const b = r === map.roots - 1 ? ZN_KEYS_HI + 1 : root + map.every / 2
        const zx = nx(Math.max(ZN_KEYS_LO, a))
        const zw = nx(Math.min(ZN_KEYS_HI + 1, b)) - zx
        const zi = l * map.roots + r
        let col = LAYER_COL[Math.min(LAYER_COL.length - 1, l + (4 - map.layers))]
        let alpha = 0.55
        if (sampling) {
          const first = (l * plan.rr) * plan.roots + r
          const last = first + (plan.rr - 1) * plan.roots
          if (take >= first && take <= last && (take - first) % plan.roots === 0) (col = '#ff3b2f'), (alpha = Math.floor(now / 200) % 2 ? 1 : 0.5)
          else if (take > last) alpha = 0.7
          else alpha = 0.18
        } else if (playing.has(zi)) (col = '#ffe08a'), (alpha = 1)
        ctx.globalAlpha = alpha
        ctx.fillStyle = col
        ctx.fillRect(zx + 1, zy + 1, zw - 2, zh - 2)
        ctx.globalAlpha = 1
        // the sampled note itself
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillRect(nx(root) + kw * 0.2, zy + 1, kw * 0.6, zh - 2)
        if (l === map.layers - 1 && zw > 26 * RES) {
          ctx.fillStyle = '#111214'
          ctx.textAlign = 'center'
          fitFont(ctx, name(root), zw - 4, Math.min(zh * 0.4, 11 * RES), FONT, '700')
          ctx.fillText(name(root), zx + zw / 2, zy + zh / 2)
        }
      }
    }
    // the keyboard
    for (let n = ZN_KEYS_LO; n <= ZN_KEYS_HI; n++) {
      ctx.fillStyle = '#e8e4da'
      ctx.fillRect(nx(n) + 0.5, ky, kw - 1, H - ky)
      if (BLACK.has(n % 12)) {
        ctx.fillStyle = '#1a1b1e'
        ctx.fillRect(nx(n) + 0.5, ky, kw - 1, (H - ky) * 0.62)
      }
      if (n % 12 === 0) {
        ctx.fillStyle = '#6a6d75'
        ctx.textAlign = 'left'
        ctx.font = `${Math.round((H - ky) * 0.22)}px ${FONT}`
        ctx.fillText(`C${n / 12 - 1}`, nx(n) + 1, H - (H - ky) * 0.18)
      }
    }
  })

  const noteAt = (cx: number, cy: number, r: DOMRect) => {
    const fx = ((cx - r.left) / r.width) * W
    const fy = ((cy - r.top) / r.height) * H
    return { note: Math.max(ZN_KEYS_LO, Math.min(ZN_KEYS_HI, ZN_KEYS_LO + Math.floor(fx / kw))), vel: Math.max(0.05, Math.min(1, (fy - ky) / (H - ky))), onKeys: fy >= ky }
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const at = noteAt(e.clientX, e.clientY, r)
    if (!at.onKeys) return
    e.stopPropagation()
    e.preventDefault()
    let last = at.note
    sendSurface(mod, 'zones', at.note, at.vel, true)
    track(
      (ev) => {
        const n = noteAt(ev.clientX, ev.clientY, r)
        if (n.note !== last) {
          last = n.note
          sendSurface(mod, 'zones', n.note, n.vel, true)
        }
      },
      () => sendSurface(mod, 'zones', last, 0, false),
    )
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }} onPointerDown={down} />
}
