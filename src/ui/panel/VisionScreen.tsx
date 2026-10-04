import { useEffect, useRef } from 'react'
import { PX } from '../geometry'

interface Props {
  mod: string
  x: number
  y: number
  w: number
  h: number
  scene: number
}

const RES = 2

/** The VISION tank's glass. three.js loads only once a tank is on the rack. */
export function VisionScreen({ mod, x, y, w, h, scene }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)

  useEffect(() => {
    let detach: (() => void) | null = null
    let dead = false
    void import('../vision/renderer').then(({ attachScreen }) => {
      if (!dead && ref.current) detach = attachScreen(ref.current, mod, () => sceneRef.current)
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
