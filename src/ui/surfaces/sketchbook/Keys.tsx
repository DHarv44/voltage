import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../../audio/telemetry'
import { SB_KEYS, SBL, SEQ } from '../../../modules/specs/sketchbook'
import { actions, patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { track } from '../../pointer'
import { RES, sendSurface, useFrame, type SurfaceProps } from '../common'
import { sketchCursor } from './cursor'

/** Which keys are black (semitone within the octave). */
const BLACK = new Set([1, 3, 6, 8, 10])
const whiteIndex = (key: number) => {
  let n = 0
  for (let k = 0; k < key; k++) if (!BLACK.has(k % 12)) n++
  return n
}
const WHITES = whiteIndex(SB_KEYS)

/** SKETCHBOOK's keybed: two octaves from C. Plays the engine; in SEQ mode a
 *  key also writes its note at the record cursor and moves it on. Slide along
 *  the keys to play legato runs. */
export function SketchKeys({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const held = useRef(-1)
  const live = () => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params

  /** Key rectangle (fractions): whites across the bed, blacks between them. */
  const keyRect = (key: number) => {
    const ww = 1 / WHITES
    if (!BLACK.has(key % 12)) return { x: whiteIndex(key) * ww, w: ww, h: 1, black: false }
    return { x: whiteIndex(key) * ww - ww * 0.3, w: ww * 0.6, h: 0.6, black: true }
  }

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const led = telemetry.leds[mod]
    const playing = (led?.[SBL.voices] ?? 0) > 0 ? (led?.[SBL.note] ?? 0) - 12 * (Math.round(live().oct) - 1) : -99
    ctx.fillStyle = '#2a2520'
    ctx.fillRect(0, 0, W, H)
    for (const black of [false, true])
      for (let k = 0; k < SB_KEYS; k++) {
        const r = keyRect(k)
        if (r.black !== black) continue
        const on = k === held.current || k === playing
        ctx.fillStyle = black ? (on ? '#ffbe3d' : '#1b1c1e') : on ? '#ffe2a6' : '#f1ece0'
        ctx.beginPath()
        ctx.roundRect(r.x * W + 2, 2, r.w * W - 4, r.h * H - 4, 6)
        ctx.fill()
      }
  })

  const keyAt = (e: { clientX: number; clientY: number }, el: Element) => {
    const b = el.getBoundingClientRect()
    const fx = (e.clientX - b.left) / b.width
    const fy = (e.clientY - b.top) / b.height
    for (let k = 0; k < SB_KEYS; k++) {
      const r = keyRect(k)
      if (r.black && fy < r.h && fx >= r.x && fx < r.x + r.w) return k
    }
    for (let k = 0; k < SB_KEYS; k++) {
      const r = keyRect(k)
      if (!r.black && fx >= r.x && fx < r.x + r.w) return k
    }
    return -1
  }

  const press = (k: number) => {
    held.current = k
    sendSurface(mod, 'key', k, 0, true)
    const p = live()
    if (Math.round(p.mode) === SEQ) {
      // step record: the note goes at the cursor, which moves on
      const len = Math.max(1, Math.round(p.len))
      const c = sketchCursor.get(mod)
      actions.setParam(mod, `n${c}`, k)
      sketchCursor.set(mod, c + 1, len)
    }
  }
  const release = () => {
    if (held.current >= 0) sendSurface(mod, 'key', held.current, 0, false)
    held.current = -1
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const el = e.currentTarget
    const k = keyAt(e, el)
    if (k < 0) return
    press(k)
    track((ev) => {
      const nk = keyAt(ev, el)
      if (nk >= 0 && nk !== held.current) {
        release()
        press(nk)
      }
    }, release)
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      title="Play (or use your computer keys / a MIDI keyboard). In SEQ mode, a key writes its note at the cursor."
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
      onPointerDown={down}
    />
  )
}
