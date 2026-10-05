import * as THREE from 'three'
import { glowPoints } from './common'
import { makeBell, makeHalo, marginPoint } from './jellyBell'
import { Tentacles } from './jellyTentacles'

const DOTS = 32

/** Where a jelly is and how it looks this frame. */
export interface JellyPose {
  pos: THREE.Vector3
  /** Lean toward/away from the glass, sideways, and the slow turn (radians). */
  pitch: number
  tilt: number
  yaw: number
  /** Bell radius (world units), contraction 0..1, light, colour, tentacle trail. */
  R: number
  action: number
  glow: number
  color: THREE.Color
  sway: number
}

/** One jellyfish's body: bell, glow halo, rim lights and trailing tentacles.
 *  The scene owns where it swims; this just draws it there. */
export class JellyBody {
  readonly body = new THREE.Group()
  private readonly bell = makeBell()
  private readonly halo = makeHalo()
  private readonly dots = glowPoints(DOTS, 0.02)
  private readonly tent: Tentacles
  private readonly arms: number
  private readonly anchors: Float32Array
  private readonly v = new THREE.Vector3()

  constructor(scene: THREE.Scene, rnd: () => number) {
    this.bell.renderOrder = 3
    this.body.add(this.bell)
    this.halo.renderOrder = 4
    this.dots.renderOrder = 5
    this.arms = 14 + Math.floor(rnd() * 6)
    this.tent = new Tentacles(this.arms)
    this.tent.lines.renderOrder = 1
    this.tent.arms.renderOrder = 2
    this.anchors = new Float32Array((this.arms + 4) * 3)
    scene.add(this.body, this.halo, this.dots, this.tent.lines, this.tent.arms)
  }

  set visible(on: boolean) {
    this.body.visible = this.halo.visible = this.dots.visible = this.tent.lines.visible = this.tent.arms.visible = on
  }

  draw(p: JellyPose, dt: number, t: number, px: number): void {
    const { body, v } = this
    body.position.copy(p.pos)
    body.rotation.set(p.pitch, p.yaw, -p.tilt)
    body.scale.setScalar(p.R)
    body.updateMatrixWorld()
    const u = this.bell.material.uniforms
    u.uC.value = p.action
    u.uT.value = t
    u.uGlow.value = p.glow
    u.uColor.value.copy(p.color)

    v.set(0, 0.25, 0)
    body.localToWorld(v)
    this.halo.position.set(v.x, v.y, v.z - 0.05)
    this.halo.scale.setScalar(p.R * 9)
    this.halo.material.uniforms.uGlow.value = p.glow
    this.halo.material.uniforms.uColor.value.copy(p.color)

    // Margin: lights around the rim, tentacle roots between them.
    const dp = this.dots.geometry.attributes.position.array as Float32Array
    const dc = this.dots.geometry.attributes.tint.array as Float32Array
    const c = p.color
    for (let i = 0; i < DOTS; i++) {
      marginPoint((i / DOTS) * Math.PI * 2, p.action, v)
      body.localToWorld(v)
      dp[i * 3] = v.x
      dp[i * 3 + 1] = v.y
      dp[i * 3 + 2] = v.z
      const b = p.glow * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7)))
      dc[i * 3] = c.r * b + 0.2 * b
      dc[i * 3 + 1] = c.g * b + 0.2 * b
      dc[i * 3 + 2] = c.b * b + 0.2 * b
    }
    this.dots.geometry.attributes.position.needsUpdate = true
    this.dots.geometry.attributes.tint.needsUpdate = true
    this.dots.material.uniforms.uPx.value = px
    this.dots.material.uniforms.uSize.value = 0.02 * (0.6 + p.R / 0.15 - 0.55)

    const n = this.arms
    for (let i = 0; i < n; i++) {
      marginPoint(((i + 0.5) / n) * Math.PI * 2, p.action, v)
      v.multiplyScalar(0.97)
      body.localToWorld(v)
      this.anchors[i * 3] = v.x
      this.anchors[i * 3 + 1] = v.y
      this.anchors[i * 3 + 2] = v.z
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      v.set(Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14)
      body.localToWorld(v)
      this.anchors[(n + i) * 3] = v.x
      this.anchors[(n + i) * 3 + 1] = v.y
      this.anchors[(n + i) * 3 + 2] = v.z
    }
    this.tent.update(this.anchors, p.R * 5.5, Math.min(dt, 1 / 30), -p.sway * 0.25, p.color, p.glow, t)
  }
}
