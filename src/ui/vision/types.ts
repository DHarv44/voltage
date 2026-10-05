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
  /** Point the camera (VIEW_CAMS index), after update. Flat scenes leave it out. */
  aim?(cam: number, dt: number): void
  dispose(): void
}

export type SceneFactory = (aspect: number, seed: number) => VisionScene
