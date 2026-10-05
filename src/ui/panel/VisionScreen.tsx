import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { sceneBlock, VISION_SCENES } from '../../modules/specs/vision'
import { patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { fillWindow, loadRenderer, popOut, touchGlass, type GlassSource } from './visionGlass'

interface Props {
  mod: string
  x: number
  y: number
  w: number
  h: number
  scene: number
  /** Camera angle (VIEW_CAMS: WIDE, ANGLE, CLOSE). */
  cam?: number
  /** Where the scene's state starts on the LED channel (0 = the tank's own scene). */
  ledBase?: number
}

/** Canvas pixels per panel pixel: sharp on high-DPI screens and when zoomed. */
const RES = Math.min(3, Math.max(2, Math.ceil((window.devicePixelRatio || 1) * 1.5)))

/** The VISION tank's glass, a touch screen. Hover for FULL SCREEN and POP OUT
 *  (its own window: a second monitor or a projector). three.js loads only once
 *  a tank is on the rack. */
export function VisionScreen({ mod, x, y, w, h, scene, cam = 0, ledBase = 0 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ scene, cam, ledBase })
  live.current = { scene, cam, ledBase }
  const [full, setFull] = useState(false)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  // the same source for the panel, full screen and pop-out: they follow the knobs
  const tank = useRef(mod)
  tank.current = mod
  const src = useRef<GlassSource>({
    mod,
    scene: () => live.current.scene,
    cam: () => live.current.cam,
    base: () => live.current.ledBase,
    // COUNT belongs to the tank (this screen may be a VIEW of it)
    count: (): number => patchStore.get().modules.find((m) => m.id === tank.current)?.params.count ?? 0.5,
  })
  src.current.mod = mod

  useEffect(() => {
    let detach: (() => void) | null = null
    let dead = false
    void loadRenderer().then((r) => {
      if (!dead && ref.current) detach = r.attachScreen(ref.current, src.current)
    })
    return () => {
      dead = true
      detach?.()
    }
  }, [mod, W, H])

  const sceneName = VISION_SCENES[Math.round(scene)] ?? 'VISION'
  return (
    <div className="vision-glass" style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}>
      <canvas
        ref={ref}
        className="vision-screen"
        width={W}
        height={H}
        onPointerDown={(e) => ref.current && touchGlass(e.nativeEvent, ref.current, src.current)}
      />
      <div className="vision-tools" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => setFull(true)} title="Full screen (Esc to leave)">
          ⛶
        </button>
        <button onClick={() => void popOut(src.current, sceneName)} title="Pop out into its own window: drag it to another screen or a projector">
          ⧉
        </button>
      </div>
      {full && <FullScreenGlass src={src.current} onClose={() => setFull(false)} />}
    </div>
  )
}

/** The tank filling the whole display. Touch still works; Esc (or ✕) leaves. */
function FullScreenGlass({ src, onClose: closeProp }: { src: GlassSource; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  // knobs re-render the panel; full screen must not restart when they do
  const closeRef = useRef(closeProp)
  closeRef.current = closeProp
  useEffect(() => {
    const onClose = () => closeRef.current()
    const el = host.current
    if (!el) return
    let close = () => {}
    let dead = false
    void fillWindow(window, el, src).then((c) => (dead ? c() : (close = c)))
    void el.requestFullscreen?.().catch(() => {}) // falls back to a full-window overlay
    const left = () => !document.fullscreenElement && onClose()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('fullscreenchange', left)
    window.addEventListener('keydown', esc)
    return () => {
      dead = true
      close()
      document.removeEventListener('fullscreenchange', left)
      window.removeEventListener('keydown', esc)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [src])
  return createPortal(
    <div className="vision-full" ref={host}>
      <button className="vision-full-x" onClick={() => closeRef.current()} title="Leave full screen (Esc)">
        ✕
      </button>
    </div>,
    document.body,
  )
}

/** A VISION VIEW's glass: shows whichever VISION / VISION CORE is patched into
 *  its LINK input: the tank's own scene (view scene 0, LINKED) or scene
 *  view − 1, through its own camera. */
export function LinkedVisionScreen({
  mod,
  cam,
  view,
  ...rect
}: {
  mod: string
  cam: number
  view: number
  x: number
  y: number
  w: number
  h: number
}) {
  const source = useSyncExternalStore(
    (f) => patchStore.subscribe(f),
    () => {
      const p = patchStore.get()
      const c = p.cables.find((k) => k.to.mod === mod && k.to.jack === 'link')
      const m = c && c.from.jack === 'link' ? p.modules.find((x) => x.id === c.from.mod) : undefined
      return m ? `${m.id}|${m.params.scene ?? 0}` : ''
    },
  )
  if (!source) {
    return (
      <div className="vision-screen vision-unlinked" style={{ left: rect.x * PX, top: rect.y * PX, width: rect.w * PX, height: rect.h * PX }}>
        Patch a VISION or VISION CORE's LINK here
      </div>
    )
  }
  const [id, tankScene] = source.split('|')
  const own = view < 1
  return (
    <VisionScreen
      mod={id}
      scene={own ? Number(tankScene) : view - 1}
      ledBase={own ? 0 : sceneBlock(view - 1)}
      cam={cam}
      {...rect}
    />
  )
}
