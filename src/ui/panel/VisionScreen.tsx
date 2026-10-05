import { useEffect, useRef, useSyncExternalStore } from 'react'
import { patchStore } from '../../patch/store'
import { PX } from '../geometry'

interface Props {
  mod: string
  x: number
  y: number
  w: number
  h: number
  scene: number
  /** Camera angle (VIEW_CAMS); scenes that aren't 3D ignore it. */
  cam?: number
}

const RES = 2

/** The VISION tank's glass. three.js loads only once a tank is on the rack. */
export function VisionScreen({ mod, x, y, w, h, scene, cam = 0 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const camRef = useRef(cam)
  camRef.current = cam
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useEffect(() => {
    let detach: (() => void) | null = null
    let dead = false
    void import('../vision/renderer').then(({ attachScreen }) => {
      if (!dead && ref.current) detach = attachScreen(ref.current, mod, () => sceneRef.current, () => camRef.current)
    })
    return () => {
      dead = true
      detach?.()
    }
  }, [mod, W, H])

  return (
    <canvas
      ref={ref}
      className="vision-screen"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
    />
  )
}

/** A VISION VIEW's glass: shows whichever VISION / VISION CORE is patched into
 *  its LINK input, through its own camera. */
export function LinkedVisionScreen({ mod, cam, ...rect }: { mod: string; cam: number; x: number; y: number; w: number; h: number }) {
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
  const [id, scene] = source.split('|')
  return <VisionScreen mod={id} scene={Number(scene)} cam={cam} {...rect} />
}
