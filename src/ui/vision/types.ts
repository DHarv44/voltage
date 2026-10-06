import type * as THREE from 'three'

/** What a piece of glass shows: a tank (module id), which scene, where that
 *  scene's state starts on the LED channel, and the tank's COUNT. (Each
 *  source also keeps its own pan and zoom: see viewer.ts.) */
export interface ScreenSource {
  mod: string
  scene: () => number
  base: () => number
  count: () => number
}

/** Smoothed creature state, read from the engine's LED channel (see VS). */
export interface CreatureView {
  /** The tank's COUNT knob (0..1, see countOf). */
  count: number
  action: number
  x: number
  y: number
  tilt: number
  glow: number
  hue: number
  grow: number
  sway: number
  wilt: number
}

/** One tank scene. The shared renderer draws it into the module's screen. */
export interface VisionScene {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  /** dt and t in seconds; `px` = drawing-buffer height in pixels (point sizes);
   *  `led` = the raw engine state (scene-specific values from VS_EXTRA on). */
  update(s: CreatureView, dt: number, t: number, px: number, led?: number[]): void
  /** Point the camera at the scene's own shot, after update (the glass's pan
   *  and zoom are applied on top of it by the renderer). */
  aim(dt: number): void
  /** A touch at (u, v) on the glass (0..1, v down) → the scene's own 0..1
   *  space (y up), as the engine's creature understands it. */
  pick(u: number, v: number): { x: number; y: number }
  dispose(): void
}

export type SceneFactory = (aspect: number, seed: number) => VisionScene
