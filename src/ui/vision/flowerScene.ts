import * as THREE from 'three'
import { GARDEN_PLANTS, PLANT_VALUES, VS_EXTRA } from '../../modules/specs/vision'
import { backdrop, CameraRig, disposeScene, glowPoints, rand, standardCamera, touchPoint, VIEW_H } from './common'
import { DUSK_SKY, leafGeometry, petalGeometry } from './flowerParts'
import { Plant, type PlantState } from './flowerPlant'
import type { SceneFactory } from './types'

const POLLEN = 160

/** A flower bed at dusk. Each plant draws its own life from the engine:
 *  sprouting, growing, blooming, wilting and fading away, then a new one
 *  coming up somewhere else. */
export const flowerScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  const sky = backdrop(aspect, DUSK_SKY)
  scene.add(sky)
  scene.add(new THREE.HemisphereLight(0xc9c0ff, 0x3a2a1a, 1.7))
  const sun = new THREE.DirectionalLight(0xffd9b0, 1.6)
  sun.position.set(-2, 1.2, 2)
  scene.add(sun)

  // A real bed on the ground: soil with lawn around it. Seen straight on it's
  // the strip along the bottom; from the ANGLE camera it's a plot you crouch by.
  const ground = -VIEW_H + 0.16
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(VIEW_H * aspect * 2.2, 1.6), new THREE.MeshStandardMaterial({ color: 0x3b2716, roughness: 1 }))
  bed.rotation.x = -Math.PI / 2
  bed.position.set(0, ground, 0.2)
  scene.add(bed)
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(VIEW_H * aspect * 5, 3), new THREE.MeshStandardMaterial({ color: 0x3f6a2a, roughness: 1 }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.set(0, ground - 0.005, 0.1)
  scene.add(lawn)

  const geo = {
    seg: new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0),
    leaf: leafGeometry(),
    petal: petalGeometry(),
    ball: new THREE.SphereGeometry(1, 14, 10),
  }
  const plants = Array.from({ length: GARDEN_PLANTS }, (_, k) => {
    const p = new Plant(rnd, geo, (k * 0.17 + rnd() * 0.05) % 1 - 0.35, 0.75 + rnd() * 0.4, rnd() < 0.5 ? -1 : 1)
    scene.add(p.root)
    return p
  })
  const state: PlantState = { x: 0, g: 0, open: 0, wilt: 0, fade: 0 }

  const pollen = glowPoints(POLLEN, 0.016)
  pollen.renderOrder = 5
  scene.add(pollen)
  const pv = new Float32Array(POLLEN * 3)
  const life = new Float32Array(POLLEN)
  let emit = 0
  let next = 0
  const baseY = ground
  const width = VIEW_H * aspect * 1.7
  const rig = new CameraRig(camera, sky)
  const hit = new THREE.Vector3()
  /** The plant CLOSE follows: the most open flower, else the tallest. */
  let star = 0
  const score = new Float32Array(GARDEN_PLANTS)

  return {
    scene,
    camera,
    aim(cam, dt) {
      if (cam === 1) {
        // ANGLE: crouched at the end of the bed, eye level with the flowers
        rig.pos.set(1.9, baseY + 0.35, 2.2)
        rig.at.set(-0.1, baseY + 0.4, 0)
      } else if (cam === 2) {
        // CLOSE: in front of the best flower
        const h = plants[star].headPos
        rig.pos.set(h.x + 0.2, h.y + 0.02, h.z + 1.2)
        rig.at.set(h.x, h.y - 0.12, h.z)
      } else {
        rig.pos.set(0, 0, 3)
        rig.at.set(0, 0, 0)
      }
      rig.apply(cam, dt)
    },
    pick(u, v) {
      // the bed's plane: x across it, y = height above the soil (0 = soil)
      if (!touchPoint(camera, u, v, 0, hit)) return { x: -1, y: -1 }
      return { x: hit.x / width + 0.5, y: (hit.y - baseY) / (2 * VIEW_H) }
    },
    update(s, dt, t, px, led) {
      sky.material.uniforms.uT.value = t
      const pp = pollen.geometry.attributes.position.array as Float32Array
      const pt = pollen.geometry.attributes.tint.array as Float32Array
      plants.forEach((p, k) => {
        const b = VS_EXTRA + k * PLANT_VALUES
        state.x = led?.[b] ?? 0.5
        state.g = led?.[b + 1] ?? (k === 0 ? 0.3 : 0)
        state.open = led?.[b + 2] ?? 0
        state.wilt = led?.[b + 3] ?? 0
        state.fade = led?.[b + 4] ?? (k === 0 ? 1 : 0)
        p.update(state, baseY, width, s.sway, s.glow, s.hue, t)
        score[k] = state.fade * (state.open * 2 + state.g)
        if (score[k] > score[star] + 0.05) star = k // a little stickiness
        // pollen from every open flower, a burst on TRIG
        if (state.fade > 0.5 && state.open > 0.2) {
          emit += dt * state.open * (0.5 + 25 * s.action)
          while (emit >= 1) {
            emit -= 1
            const i = next++ % POLLEN
            pp.set([p.headPos.x + (rnd() - 0.5) * 0.06, p.headPos.y, p.headPos.z + 0.03], i * 3)
            pv.set([(rnd() - 0.5) * 0.08, 0.04 + rnd() * 0.06, (rnd() - 0.5) * 0.04], i * 3)
            life[i] = 1
          }
        }
      })
      for (let i = 0; i < POLLEN; i++) {
        const k = i * 3
        if (life[i] <= 0) {
          pt[k] = pt[k + 1] = pt[k + 2] = 0
          continue
        }
        life[i] -= dt / 4
        pp[k] += (pv[k] - s.sway * 0.05) * dt
        pp[k + 1] += pv[k + 1] * dt
        pp[k + 2] += pv[k + 2] * dt
        const b = Math.max(0, life[i]) * (0.4 + 0.6 * Math.sin(t * 6 + i) ** 2)
        pt[k] = b
        pt[k + 1] = b * 0.85
        pt[k + 2] = b * 0.45
      }
      pollen.geometry.attributes.position.needsUpdate = true
      pollen.geometry.attributes.tint.needsUpdate = true
      pollen.material.uniforms.uPx.value = px
    },
    dispose() {
      disposeScene(scene)
    },
  }
}
