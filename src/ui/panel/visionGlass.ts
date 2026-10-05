import { engine } from '../../audio/engine'
import type { ScreenSource } from '../vision/types'

/** What a piece of glass shows (see ScreenSource). */
export type GlassSource = ScreenSource

type Renderer = typeof import('../vision/renderer')
let renderer: Renderer | null = null
/** three.js and the scenes load only once a tank is on the rack. */
export const loadRenderer = async (): Promise<Renderer> => (renderer ??= await import('../vision/renderer'))
export const loadedRenderer = () => renderer

/** Touch on a piece of glass: each touch goes, through that screen's camera,
 *  to the scene it shows. Works in any window (pop-outs track their own). */
export function touchGlass(e: PointerEvent, canvas: HTMLCanvasElement, src: GlassSource): void {
  const r = renderer
  if (e.button !== 0 || !r) return
  e.stopPropagation()
  e.preventDefault()
  const win = canvas.ownerDocument.defaultView ?? window
  const name = `touch${Math.round(src.scene())}`
  const send = (cx: number, cy: number, down: boolean) => {
    const b = canvas.getBoundingClientRect()
    const p = r.pickAt(canvas, (cx - b.left) / b.width, (cy - b.top) / b.height)
    engine.ui(src.mod, { kind: 'surface', name, x: p.x, y: p.y, down })
  }
  send(e.clientX, e.clientY, true)
  const move = (ev: PointerEvent) => send(ev.clientX, ev.clientY, true)
  const up = (ev: PointerEvent) => {
    send(ev.clientX, ev.clientY, false)
    win.removeEventListener('pointermove', move)
    win.removeEventListener('pointerup', up)
    win.removeEventListener('pointercancel', up)
  }
  win.addEventListener('pointermove', move)
  win.addEventListener('pointerup', up)
  win.addEventListener('pointercancel', up)
}

/** Fill a whole window (or full-screen overlay) with a tank: a canvas sized
 *  to it, re-attached whenever it resizes so the picture never stretches.
 *  Returns the close function. */
export async function fillWindow(win: Window, host: HTMLElement, src: GlassSource): Promise<() => void> {
  const r = await loadRenderer()
  const doc = win.document
  const canvas = doc.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:pointer'
  host.appendChild(canvas)
  canvas.addEventListener('pointerdown', (e) => touchGlass(e, canvas, src))
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
