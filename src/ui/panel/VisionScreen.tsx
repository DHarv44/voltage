import type React from 'react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { engine } from '../../audio/engine'
import { sceneBlock } from '../../modules/specs/vision'
import { patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'

interface Props {
  mod: string
  x: number
  y: number
  w: number
  h: number
  scene: number
  /** Camera angle (VIEW_CAMS); scenes that aren't 3D ignore it. */
  cam?: number
  /** Where the scene's state starts on the LED channel (0 = the tank's own scene). */
  ledBase?: number
}

const RES = 2

/** The VISION tank's glass. three.js loads only once a tank is on the rack. */
export function VisionScreen({ mod, x, y, w, h, scene, cam = 0, ledBase = 0 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const camRef = useRef(cam)
  camRef.current = cam
  const baseRef = useRef(ledBase)
  baseRef.current = ledBase
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  const pick = useRef<((c: HTMLCanvasElement, u: number, v: number) => { x: number; y: number }) | null>(null)

  useEffect(() => {
    let detach: (() => void) | null = null
    let dead = false
    void import('../vision/renderer').then(({ attachScreen, pickAt }) => {
      pick.current = pickAt
      if (!dead && ref.current)
        detach = attachScreen(
          ref.current,
          mod,
          () => sceneRef.current,
          () => camRef.current,
          () => baseRef.current,
        )
    })
    return () => {
      dead = true
      detach?.()
    }
  }, [mod, W, H])

  // The glass is a touch screen: each touch goes, through this screen's
  // camera, to the scene it shows (in the module that runs the tank).
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !pick.current) return
    e.stopPropagation()
    e.preventDefault()
    const canvas = e.currentTarget
    const name = `touch${Math.round(sceneRef.current)}`
    const send = (cx: number, cy: number, isDown: boolean) => {
      const r = canvas.getBoundingClientRect()
      const p = pick.current!(canvas, (cx - r.left) / r.width, (cy - r.top) / r.height)
      engine.ui(mod, { kind: 'surface', name, x: p.x, y: p.y, down: isDown })
    }
    send(e.clientX, e.clientY, true)
    track(
      (ev) => send(ev.clientX, ev.clientY, true),
      (ev) => send(ev.clientX, ev.clientY, false),
    )
  }

  return (
    <canvas
      ref={ref}
      className="vision-screen"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
      onPointerDown={down}
    />
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
