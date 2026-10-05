import type * as THREE from 'three'

/** Smoothed creature state, read from the engine's LED channel (see VS). */
export interface CreatureView {
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
  /** Point the camera (VIEW_CAMS index: WIDE, ANGLE, CLOSE), after update. */
  aim(cam: number, dt: number): void
  /** A touch at (u, v) on the glass (0..1, v down) → the scene's own 0..1
   *  space (y up), as the engine's creature understands it. */
  pick(u: number, v: number): { x: number; y: number }
  dispose(): void
}

export type SceneFactory = (aspect: number, seed: number) => VisionScene
