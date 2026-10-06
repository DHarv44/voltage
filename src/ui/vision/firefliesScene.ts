import * as THREE from 'three'
import { FIREFLIES, VS_EXTRA } from '../../modules/specs/vision'
import { backdrop, CameraRig, disposeScene, glowPoints, rand, standardCamera, VIEW_H } from './common'
import { MEADOW_SKY } from './flowerParts'
import type { SceneFactory } from './types'

/** Fireflies drifting over a meadow; each flashes when the engine says so.
 *  They wander in depth too, so the ANGLE camera sees a swarm, not a sheet. */
export const firefliesScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  const sky = backdrop(aspect, MEADOW_SKY)
  scene.add(sky)
  // the meadow floor they hover over (gives the ANGLE camera something to stand on)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(VIEW_H * aspect * 5, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.06, 0.03) }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, -VIEW_H * 0.82, -0.2)
  scene.add(floor)
  const core = glowPoints(FIREFLIES, 0.045)
  const halo = glowPoints(FIREFLIES, 0.22)
  scene.add(halo, core)
  // each fly's own lazy figure-of-eight through the grass
  const path = Array.from({ length: FIREFLIES }, () => ({
    x: rnd() * 2 - 1,
    y: rnd(),
    z: rnd() * 1.4 - 0.9,
    fx: 0.05 + rnd() * 0.12,
    fy: 0.07 + rnd() * 0.15,
    fz: 0.04 + rnd() * 0.08,
    ph: rnd() * 10,
  }))
  const W = VIEW_H * aspect
  const col = new THREE.Color()
  const rig = new CameraRig(camera, sky)
  return {
    scene,
    camera,
    aim(dt) {
      rig.pos.set(0, 0, 3)
      rig.at.set(0, 0, 0)
      rig.apply(dt)
    },
    pick(u, v) {
      // the flies answer a flash wherever it is; drags read left/right
      return { x: u, y: 1 - v }
    },
    update(s, _dt, t, px, led) {
      sky.material.uniforms.uT.value = t
      const cp = core.geometry.attributes.position.array as Float32Array
      const ct = core.geometry.attributes.tint.array as Float32Array
      const hp = halo.geometry.attributes.position.array as Float32Array
      const ht = halo.geometry.attributes.tint.array as Float32Array
      col.setHSL((0.17 + (s.hue - 0.55) * 0.3 + 1) % 1, 0.9, 0.6)
      for (let k = 0; k < FIREFLIES; k++) {
        const p = path[k]
        // MOTION (drift, MOVE, a herding finger) carries the whole swarm
        const x = p.x * W * 0.85 + Math.sin(t * p.fx + p.ph) * 0.25 + s.sway * 0.3
        const y = -VIEW_H * 0.6 + p.y * VIEW_H * 1.1 + Math.sin(t * p.fy * 2 + p.ph) * 0.12
        const z = p.z + Math.sin(t * p.fz + p.ph * 1.3) * 0.25
        // −1: not flying tonight (COUNT); hidden entirely
        const raw = led?.[VS_EXTRA + k] ?? (k < 24 ? 0 : -1)
        const b = raw < 0 ? 0 : raw * 1.6
        const base = raw < 0 ? 0 : 0.02
        for (const [pos, tint, gain] of [
          [cp, ct, 1],
          [hp, ht, 0.35],
        ] as const) {
          pos[k * 3] = x
          pos[k * 3 + 1] = y
          pos[k * 3 + 2] = z
          tint[k * 3] = col.r * b * gain + base
          tint[k * 3 + 1] = col.g * b * gain + base
          tint[k * 3 + 2] = col.b * b * gain
        }
      }
      for (const pts of [core, halo]) {
        pts.geometry.attributes.position.needsUpdate = true
        pts.geometry.attributes.tint.needsUpdate = true
        pts.material.uniforms.uPx.value = px
      }
    },
    dispose() {
      disposeScene(scene)
    },
  }
}
