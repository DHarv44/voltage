import * as THREE from 'three'

/** Furthest in you can zoom: this much magnification at the scene's middle. */
const MAX_ZOOM = 5

const right = new THREE.Vector3()
const up = new THREE.Vector3()
const fwd = new THREE.Vector3()

/** A piece of glass's own pan and zoom, like a photo on a touch screen: it
 *  moves the camera along its own axes (never turning it) on top of the
 *  scene's shot. Zooming moves in along the ray under the pointer, so what's
 *  under it stays under it; panning moves with the finger. You can't zoom
 *  out or pan past the scene's own framing, so no edge of the world shows. */
export class Viewer {
  /** Magnification (1 = the scene's own shot), and the sideways/up shift
   *  as a fraction of the scene's half-view (−1..1, limited by the zoom). */
  private mag = 1
  private px = 0
  private py = 0
  /** Objects that ride with the camera (the backdrop) while it's moved. */
  private moved: THREE.Object3D[] = []
  /** How far the camera is moved right now (between apply and restore). */
  private readonly off = new THREE.Vector3()

  get changed(): boolean {
    return this.mag > 1.0005
  }

  reset(): void {
    this.mag = 1
    this.px = this.py = 0
  }

  /** Zoom by `factor` (> 1 in) about the point (nx, ny) on the glass (−1..1, y up). */
  zoom(factor: number, nx: number, ny: number): void {
    const before = this.mag
    this.mag = Math.min(MAX_ZOOM, Math.max(1, this.mag * factor))
    // moving in along the ray through (nx, ny) keeps that point still:
    // the visible window's centre slides toward it by the zoomed-away part
    const k = 1 / before - 1 / this.mag
    this.px += nx * k
    this.py += ny * k
    this.clamp()
  }

  /** Pan by (du, dv), fractions of the glass (v down): the picture follows. */
  pan(du: number, dv: number): void {
    this.px -= (du * 2) / this.mag
    this.py += (dv * 2) / this.mag
    this.clamp()
  }

  /** The visible window stays inside the scene's own frame. */
  private clamp(): void {
    const room = 1 - 1 / this.mag
    this.px = Math.max(-room, Math.min(room, this.px))
    this.py = Math.max(-room, Math.min(room, this.py))
  }

  /** Move the camera (and whatever rides with it) for drawing or picking;
   *  `restore` puts the scene's own shot back. */
  apply(cam: THREE.PerspectiveCamera, scene: THREE.Scene): void {
    this.moved = []
    if (!this.changed) return
    cam.updateMatrixWorld()
    right.setFromMatrixColumn(cam.matrixWorld, 0)
    up.setFromMatrixColumn(cam.matrixWorld, 1)
    fwd.setFromMatrixColumn(cam.matrixWorld, 2).negate()
    // the scene's middle is about where the camera's distance from the origin says
    const dist = cam.position.length()
    const tanY = Math.tan(((cam.fov / 2) * Math.PI) / 180)
    const tanX = tanY * cam.aspect
    const ahead = dist * (1 - 1 / this.mag)
    const off = this.off
    off
      .copy(fwd)
      .multiplyScalar(ahead)
      .addScaledVector(right, this.px * dist * tanX)
      .addScaledVector(up, this.py * dist * tanY)
    cam.position.add(off)
    cam.updateMatrixWorld()
    for (const o of scene.children) {
      if (!o.userData.followsCamera) continue
      o.position.add(off)
      o.updateMatrixWorld()
      this.moved.push(o)
    }
  }

  restore(cam: THREE.PerspectiveCamera): void {
    if (!this.changed) return
    cam.position.sub(this.off)
    cam.updateMatrixWorld()
    for (const o of this.moved) {
      o.position.sub(this.off)
      o.updateMatrixWorld()
    }
  }
}
