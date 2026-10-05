import * as THREE from 'three'
import { LED_BLOCK, VS } from '../../modules/specs/vision'
import { telemetry } from '../../audio/telemetry'
import { hashSeed } from './common'
import { flowerScene } from './flowerScene'
import { jellyScene } from './jellyScene'
import { auroraScene } from './auroraScene'
import { cymaticsScene } from './cymaticsScene'
import { firefliesScene } from './firefliesScene'
import type { CreatureView, SceneFactory, VisionScene } from './types'

/** In SCENE knob order (VISION_SCENES). */
const SCENES: SceneFactory[] = [jellyScene, flowerScene, firefliesScene, auroraScene, cymaticsScene]

interface Screen {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  mod: string
  scene: () => number
  cam: () => number
  /** Where this screen's scene starts on the LED channel (see sceneBlock). */
  base: () => number
  host: VisionScene | null
  hostIdx: number
  view: CreatureView
  t: number
}

// Browsers cap live WebGL contexts (~16), so every tank shares one renderer:
// each screen is drawn into the corner of one offscreen canvas and copied out.
let renderer: THREE.WebGLRenderer | null = null
const screens = new Set<Screen>()
let raf = 0
let last = 0

function gl(): THREE.WebGLRenderer {
  if (renderer) return renderer
  // Colours are authored as display values: no linear/sRGB conversion anywhere.
  THREE.ColorManagement.enabled = false
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.setPixelRatio(1)
  renderer.setScissorTest(true)
  return renderer
}

const blankView = (): CreatureView => ({ action: 0, x: 0.5, y: 0.45, tilt: 0, glow: 0.3, hue: 0.55, grow: 0.3, sway: 0, wilt: 0 })

/** Ease the 30 Hz engine state toward a smooth 60 fps view. */
function follow(v: CreatureView, led: number[] | undefined, dt: number): void {
  if (!led) return
  const k = 1 - Math.exp(-dt / 0.05)
  v.action += (led[VS.action] - v.action) * k
  v.x += (led[VS.x] - v.x) * k
  v.y += (led[VS.y] - v.y) * k
  v.tilt += (led[VS.tilt] - v.tilt) * k
  v.glow += (led[VS.glow] - v.glow) * k
  v.grow += (led[VS.grow] - v.grow) * k
  v.sway += (led[VS.sway] - v.sway) * k
  v.wilt += (led[VS.wilt] - v.wilt) * k
  let dh = led[VS.hue] - v.hue // the shortest way round the colour wheel
  dh -= Math.round(dh)
  v.hue = (v.hue + dh * k + 1) % 1
}

function frame(now: number): void {
  raf = screens.size ? requestAnimationFrame(frame) : 0
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60)
  last = now
  const r = gl()
  const size = r.getSize(new THREE.Vector2())
  let needW = size.x
  let needH = size.y
  for (const s of screens) {
    needW = Math.max(needW, s.canvas.width)
    needH = Math.max(needH, s.canvas.height)
  }
  if (needW !== size.x || needH !== size.y) r.setSize(needW, needH, false)

  for (const s of screens) {
    const box = s.canvas.getBoundingClientRect()
    if (box.bottom < 0 || box.right < 0 || box.top > innerHeight || box.left > innerWidth || box.width === 0) continue
    const W = s.canvas.width
    const H = s.canvas.height
    const idx = Math.min(SCENES.length - 1, Math.max(0, Math.round(s.scene())))
    if (!s.host || s.hostIdx !== idx) {
      s.host?.dispose()
      s.host = SCENES[idx](W / H, hashSeed(s.mod))
      s.hostIdx = idx
    }
    s.t += dt
    const raw = telemetry.leds[s.mod]
    const base = s.base()
    const led = raw && base ? raw.slice(base, base + LED_BLOCK) : raw
    follow(s.view, led, dt)
    s.host.update(s.view, dt, s.t, H, led)
    s.host.aim(Math.round(s.cam()), dt)
    r.setViewport(0, 0, W, H)
    r.setScissor(0, 0, W, H)
    r.render(s.host.scene, s.host.camera)
    s.ctx.drawImage(r.domElement, 0, needH - H, W, H, 0, 0, W, H)
  }
}

/** A touch at (u, v) on this screen's glass, in its scene's own space (seen
 *  through whatever camera the screen uses). */
export function pickAt(canvas: HTMLCanvasElement, u: number, v: number): { x: number; y: number } {
  for (const s of screens) if (s.canvas === canvas && s.host) return s.host.pick(u, v)
  return { x: u, y: 1 - v }
}

/** Start drawing a tank into `canvas`; returns the detach function. */
export function attachScreen(
  canvas: HTMLCanvasElement,
  mod: string,
  scene: () => number,
  cam: () => number = () => 0,
  base: () => number = () => 0,
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const s: Screen = { canvas, ctx, mod, scene, cam, base, host: null, hostIdx: -1, view: blankView(), t: 0 }
  screens.add(s)
  if (!raf) {
    last = 0
    raf = requestAnimationFrame(frame)
  }
  return () => {
    screens.delete(s)
    s.host?.dispose()
    if (!screens.size && raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }
}
