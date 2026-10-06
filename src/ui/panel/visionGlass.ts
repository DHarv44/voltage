import { engine } from '../../audio/engine'
import type { ScreenSource } from '../vision/types'

/** What a piece of glass shows (see ScreenSource). */
export type GlassSource = ScreenSource

type Renderer = typeof import('../vision/renderer')
let renderer: Renderer | null = null
/** three.js and the scenes load only once a tank is on the rack. */
export const loadRenderer = async (): Promise<Renderer> => (renderer ??= await import('../vision/renderer'))
export const loadedRenderer = () => renderer

/** What the glass's gestures do, for its tooltip. */
export const GLASS_HINT = 'Touch screen: touch or drag to play with the scene · scroll or pinch to zoom · middle-drag or two fingers to pan'

/** A piece of glass is a touch screen. One finger (or the left button)
 *  touches the scene, through the glass's camera, wherever it's panned and
 *  zoomed; two fingers pinch to zoom and drag to pan (a second finger turns a
 *  touch into that); the mouse wheel zooms at the pointer and middle-drag
 *  pans. Right-click is left for the module's menu. Works in any window
 *  (pop-outs have their own). Returns the detach function. */
export function attachGlass(canvas: HTMLCanvasElement, src: GlassSource): () => void {
  const fingers = new Map<number, { x: number; y: number }>()
  /** The pointer touching the scene, the middle button panning, and the pinch so far. */
  let touching: number | null = null
  let panning: { id: number; x: number; y: number } | null = null
  let pinch: { x: number; y: number; d: number } | null = null
  const box = () => canvas.getBoundingClientRect()
  const send = (cx: number, cy: number, down: boolean) => {
    const r = renderer
    if (!r) return
    const b = box()
    const p = r.pickAt(canvas, (cx - b.left) / b.width, (cy - b.top) / b.height)
    engine.ui(src.mod, { kind: 'surface', name: `touch${Math.round(src.scene())}`, x: p.x, y: p.y, down })
  }
  const spread = () => {
    const [a, b] = [...fingers.values()]
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) }
  }

  const down = (e: PointerEvent) => {
    if (e.button === 2 || !renderer) return
    e.stopPropagation()
    e.preventDefault()
    try {
      canvas.setPointerCapture(e.pointerId) // keep the gesture when a finger slides off the glass
    } catch {
      // the pointer already went away
    }
    if (e.button === 1) {
      panning = { id: e.pointerId, x: e.clientX, y: e.clientY }
      return
    }
    if (e.button !== 0) return
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (fingers.size === 1) {
      touching = e.pointerId
      send(e.clientX, e.clientY, true)
    } else if (fingers.size === 2) {
      // a second finger: this is a pinch, not a touch
      if (touching !== null) {
        const f = fingers.get(touching)!
        send(f.x, f.y, false)
        touching = null
      }
      pinch = spread()
    }
  }
  const move = (e: PointerEvent) => {
    const r = renderer
    if (!r) return
    if (panning && e.pointerId === panning.id) {
      const b = box()
      r.panView(src, (e.clientX - panning.x) / b.width, (e.clientY - panning.y) / b.height)
      panning.x = e.clientX
      panning.y = e.clientY
      return
    }
    if (!fingers.has(e.pointerId)) return
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (e.pointerId === touching) send(e.clientX, e.clientY, true)
    else if (pinch && fingers.size >= 2) {
      const now = spread()
      const b = box()
      r.zoomView(src, now.d / pinch.d, (now.x - b.left) / b.width, (now.y - b.top) / b.height)
      r.panView(src, (now.x - pinch.x) / b.width, (now.y - pinch.y) / b.height)
      pinch = now
    }
  }
  const up = (e: PointerEvent) => {
    if (panning && e.pointerId === panning.id) panning = null
    if (!fingers.has(e.pointerId)) return
    fingers.delete(e.pointerId)
    if (e.pointerId === touching) {
      send(e.clientX, e.clientY, false)
      touching = null
    }
    if (fingers.size < 2) pinch = null // the finger left behind doesn't start touching
  }
  const wheel = (e: WheelEvent) => {
    const r = renderer
    if (!r) return
    e.preventDefault()
    const b = box()
    const dy = e.deltaY * (e.deltaMode === 1 ? 33 : 1)
    r.zoomView(src, Math.exp(-dy * 0.0015), (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height)
  }

  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('wheel', wheel, { passive: false })
  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    canvas.removeEventListener('wheel', wheel)
  }
}

/** Fill a whole window (or full-screen overlay) with a tank: a canvas sized
 *  to it, re-attached whenever it resizes so the picture never stretches.
 *  Returns the close function. */
export async function fillWindow(win: Window, host: HTMLElement, src: GlassSource): Promise<() => void> {
  const r = await loadRenderer()
  const doc = win.document
  const canvas = doc.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:pointer'
  canvas.title = GLASS_HINT
  host.appendChild(canvas)
  const unglass = attachGlass(canvas, src)
  let detach = () => {}
  const fit = () => {
    // device pixels, capped so a 4K screen doesn't melt the GPU
    const dpr = Math.min(2, win.devicePixelRatio || 1)
    const scale = Math.min(dpr, 2560 / Math.max(1, win.innerWidth))
    canvas.width = Math.round(win.innerWidth * scale)
    canvas.height = Math.round(win.innerHeight * scale)
    detach()
    detach = r.attachScreen(canvas, src, true)
  }
  fit()
  let t = 0
  const resized = () => {
    win.clearTimeout(t)
    t = win.setTimeout(fit, 120)
  }
  win.addEventListener('resize', resized)
  return () => {
    win.removeEventListener('resize', resized)
    detach()
    unglass()
    canvas.remove()
  }
}

/** Open the tank in its own window: drag it to a second screen or a projector. */
export async function popOut(src: GlassSource, title: string): Promise<void> {
  const win = window.open('', `voltage-vision-${src.mod}`, 'width=1280,height=720')
  if (!win) return alert('The pop-out window was blocked: allow pop-ups for this site and try again.')
  win.document.title = `${title} · VOLTAGE`
  win.document.body.style.cssText = 'margin:0;background:#000;overflow:hidden'
  win.document.body.replaceChildren()
  const close = await fillWindow(win, win.document.body, src)
  win.addEventListener('pagehide', close)
  window.addEventListener('pagehide', () => win.close()) // the rack drives it: close with the rack
}
