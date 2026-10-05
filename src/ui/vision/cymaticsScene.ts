import * as THREE from 'three'
import { CYM } from '../../modules/specs/vision'
import { CameraRig, disposeScene, glowPoints, rand, standardCamera, touchPoint, VIEW_H } from './common'
import type { SceneFactory } from './types'

const GRAINS = 2500

/** A Chladni plate: sand shaken off the moving parts collects on the still
 *  lines of the current mode. A knock throws it up; a tilt slides it downhill. */
export const cymaticsScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0.06, 0.06, 0.07)
  const camera = standardCamera(aspect)
  const S = VIEW_H * 0.92
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.15, 0.14) }))
  plate.position.z = -0.01
  scene.add(plate)
  const sand = glowPoints(GRAINS, 0.016)
  scene.add(sand)
  const u = new Float32Array(GRAINS) // grain positions on the plate, 0..1
  const v = new Float32Array(GRAINS)
  for (let i = 0; i < GRAINS; i++) {
    u[i] = rnd()
    v[i] = rnd()
  }
  const PI = Math.PI
  let m = 1
  let n = 2
  let sign = -1
  // mode shape: how much the plate moves at (x, y); square plates have both
  // the symmetric (+) and antisymmetric (−) combinations
  const amp = (x: number, y: number) => Math.cos(n * PI * x) * Math.cos(m * PI * y) + sign * Math.cos(m * PI * x) * Math.cos(n * PI * y)
  const sandCol = new THREE.Color()
  const rig = new CameraRig(camera)
  const hit = new THREE.Vector3()
  return {
    scene,
    camera,
    aim(cam, dt) {
      if (cam === 1) {
        // ANGLE: the plate seen at a slant, as if leaning over the bench
        rig.pos.set(0, -2.3, 1.8)
        rig.at.set(0, -0.1, 0)
      } else if (cam === 2) {
        // CLOSE: down into the middle of the figure
        rig.pos.set(0, 0, 1.25)
        rig.at.set(0, 0, 0)
      } else {
        rig.pos.set(0, 0, 3)
        rig.at.set(0, 0, 0)
      }
      rig.apply(cam, dt)
    },
    pick(pu, pv) {
      // on the plate itself, 0..1 across and up
      if (!touchPoint(camera, pu, pv, 0, hit)) return { x: -1, y: -1 }
      return { x: (hit.x / S + 1) / 2, y: (hit.y / S + 1) / 2 }
    },
    update(s, _dt, _t, px, led) {
      m = led?.[CYM.m] ?? 1
      n = led?.[CYM.n] ?? 2
      sign = (led?.[CYM.mode] ?? 0) % 2 === 0 ? -1 : 1
      const knock = led?.[CYM.knock] ?? 0
      const tilt = led?.[CYM.tilt] ?? 0
      const drive = s.action
      const pos = sand.geometry.attributes.position.array as Float32Array
      const tint = sand.geometry.attributes.tint.array as Float32Array
      sandCol.setHSL(s.hue, 0.25, 0.75)
      const e = 0.004
      for (let i = 0; i < GRAINS; i++) {
        const a = amp(u[i], v[i])
        // bounce where the plate moves (a knock throws everything up)...
        const shake = Math.abs(a) * drive * 0.02 + knock * 0.03
        // ...and slide toward the still lines, and downhill if it's tilted
        const gx = (amp(u[i] + e, v[i]) ** 2 - a * a) / e
        const gy = (amp(u[i], v[i] + e) ** 2 - a * a) / e
        u[i] = Math.min(1, Math.max(0, u[i] + (rnd() - 0.5) * shake - gx * 0.0006 * drive + tilt * 0.0015))
        v[i] = Math.min(1, Math.max(0, v[i] + (rnd() - 0.5) * shake - gy * 0.0006 * drive))
        pos[i * 3] = (u[i] * 2 - 1) * S
        pos[i * 3 + 1] = (v[i] * 2 - 1) * S
        // a knock lifts the grains off the plate for a moment
        pos[i * 3 + 2] = knock * rnd() * 0.06
        const b = 0.7 + 0.5 * s.glow
        tint[i * 3] = sandCol.r * b
        tint[i * 3 + 1] = sandCol.g * b
        tint[i * 3 + 2] = sandCol.b * b
      }
      sand.geometry.attributes.position.needsUpdate = true
      sand.geometry.attributes.tint.needsUpdate = true
      sand.material.uniforms.uPx.value = px
    },
    dispose() {
      disposeScene(scene)
    },
  }
}
