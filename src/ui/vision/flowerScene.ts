import * as THREE from 'three'
import { FLOWER_STAGES } from '../../modules/specs/vision'
import { backdrop, disposeScene, glowPoints, rand, smooth, standardCamera, VIEW_H } from './common'
import { leafGeometry, NIGHT_SKY, petalGeometry, soil } from './flowerParts'
import type { SceneFactory } from './types'

const SEGS = 16
const STEM_LEN = 1.2
const PETALS = 8
const POLLEN = 120
const LEAF_AT = [3, 5, 7, 9]
const HEALTHY = new THREE.Color(0.2, 0.46, 0.17)
const DRY = new THREE.Color(0.36, 0.28, 0.12)
const BROWN = new THREE.Color(0.32, 0.18, 0.08)

/** A flower growing out of a soil mound under a night sky. Its skeleton is a
 *  chain of stem joints, so wind (SWAY) and wilting bend it the way a real stem
 *  bends: hardly at the base, most near the head. */
export const flowerScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  const sky = backdrop(aspect, NIGHT_SKY)
  scene.add(sky)
  scene.add(new THREE.HemisphereLight(0x8f86ff, 0x1a0f0a, 1.1))
  const moon = new THREE.DirectionalLight(0xd4dcff, 1.3)
  moon.position.set(-1, 2, 2)
  scene.add(moon)
  const bloomLight = new THREE.PointLight(0xffffff, 0, 0, 0)
  scene.add(bloomLight)

  const ground = soil(VIEW_H * aspect * 0.7)
  ground.position.y = -VIEW_H
  scene.add(ground)

  const stemMat = new THREE.MeshStandardMaterial({ color: HEALTHY.clone(), roughness: 0.7 })
  const leafMat = new THREE.MeshStandardMaterial({ color: HEALTHY.clone(), roughness: 0.6, side: THREE.DoubleSide })
  const petalMat = new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide })
  const centreMat = new THREE.MeshStandardMaterial({ color: 0xffc23a, emissive: 0xffa31a, roughness: 0.8 })
  const segGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0)

  // Stem: a chain of joints; each joint holds one segment and the next joint.
  const joints: THREE.Group[] = []
  const segs: THREE.Mesh[] = []
  let parent: THREE.Object3D = scene
  for (let k = 0; k < SEGS; k++) {
    const j = new THREE.Group()
    const m = new THREE.Mesh(segGeo, stemMat)
    j.add(m)
    parent.add(j)
    joints.push(j)
    segs.push(m)
    parent = j
  }
  joints[0].position.set(0, -VIEW_H + 0.14, 0)
  const curve = Array.from({ length: SEGS }, (_, k) => (rnd() - 0.5) * 0.05 + Math.sin((k / SEGS) * Math.PI * 2) * 0.012)
  const lean = rnd() < 0.5 ? -1 : 1

  const leafGeo = leafGeometry()
  const leaves = LEAF_AT.map((at, i) => {
    const pivot = new THREE.Group()
    const leaf = new THREE.Mesh(leafGeo, leafMat)
    pivot.add(leaf)
    joints[at].add(pivot)
    const side = i % 2 === 0 ? 1 : -1
    pivot.rotation.y = side * 0.5
    return { pivot, leaf, side, stage: FLOWER_STAGES[i] }
  })

  const head = new THREE.Group()
  const petalGeo = petalGeometry()
  const petals = Array.from({ length: PETALS }, (_, i) => {
    const pivot = new THREE.Group()
    pivot.rotation.y = (i / PETALS) * Math.PI * 2 + (rnd() - 0.5) * 0.15
    const petal = new THREE.Mesh(petalGeo, petalMat)
    pivot.add(petal)
    head.add(pivot)
    return { petal, jitter: (rnd() - 0.5) * 0.2 }
  })
  const centre = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), centreMat)
  head.add(centre)
  joints[SEGS - 1].add(head)

  const pollen = glowPoints(POLLEN, 0.016)
  pollen.renderOrder = 5
  scene.add(pollen)
  const pv = new Float32Array(POLLEN * 3)
  const life = new Float32Array(POLLEN)
  let emit = 0
  let next = 0

  const color = new THREE.Color()
  const v = new THREE.Vector3()

  return {
    scene,
    camera,
    update(s, dt, t, px) {
      sky.material.uniforms.uT.value = t
      const g = s.grow
      const wilt = s.wilt
      const stem = STEM_LEN * smooth(0, 0.8, g) + 0.02
      const seg = stem / SEGS
      for (let k = 0; k < SEGS; k++) {
        const f = k / SEGS
        if (k > 0) joints[k].position.y = seg
        const r = (0.014 - 0.007 * f) * (0.35 + 0.65 * smooth(0, 0.8, g))
        segs[k].scale.set(r, seg, r)
        joints[k].rotation.z = curve[k] - s.sway * 0.04 * f - lean * wilt * 0.2 * f * f
        joints[k].rotation.x = Math.sin(t * 0.7 + k * 0.4) * 0.004
      }
      stemMat.color.copy(HEALTHY).lerp(DRY, wilt)
      leafMat.color.copy(HEALTHY).lerp(DRY, wilt * 0.9)

      for (const l of leaves) {
        const grown = smooth(l.stage, l.stage + 0.14, g)
        l.leaf.visible = grown > 0.01
        l.leaf.scale.setScalar(0.24 * grown * (1 - wilt * 0.15))
        const flutter = Math.sin(t * 2.1 + l.stage * 20) * 0.04 * (1 + Math.abs(s.sway))
        l.pivot.rotation.z = -l.side * (0.95 + wilt * 1.2 + flutter)
      }

      // Head: a bud from stage 5, petals fold open as it blooms and droop as it wilts.
      const bud = smooth(FLOWER_STAGES[4] - 0.03, FLOWER_STAGES[5], g)
      head.visible = bud > 0.01
      head.position.y = seg
      head.rotation.x = 0.35 + s.action * 0.6 + wilt * 0.9
      head.rotation.z = -lean * wilt * 0.6
      color.setHSL(s.hue, 0.75, 0.58).lerp(BROWN, wilt * 0.8)
      petalMat.color.copy(color)
      petalMat.emissive.copy(color).multiplyScalar(Math.min(1.2, s.glow) * 0.45)
      for (const p of petals) {
        p.petal.scale.setScalar(0.17 * (0.35 + 0.65 * bud))
        p.petal.rotation.x = 0.1 + s.action * 1.3 + p.jitter * s.action + wilt * 0.7
      }
      centre.scale.setScalar(0.03 * smooth(0.2, 1, s.action) + 0.001)
      centreMat.emissiveIntensity = 0.2 + s.glow * 0.8

      head.getWorldPosition(v)
      bloomLight.position.set(v.x, v.y, v.z + 0.25)
      bloomLight.color.setHSL(s.hue, 0.7, 0.6)
      bloomLight.intensity = s.glow * s.action * 1.5

      // Pollen: shed from the open flower, more when it flares (TRIG).
      emit += dt * s.action * (0.6 + 2 * s.action + 30 * Math.max(0, s.glow - 0.75))
      const pp = pollen.geometry.attributes.position.array as Float32Array
      const pt = pollen.geometry.attributes.tint.array as Float32Array
      while (emit >= 1) {
        emit -= 1
        const i = next++ % POLLEN
        pp.set([v.x + (rnd() - 0.5) * 0.06, v.y + (rnd() - 0.5) * 0.04, v.z + 0.03], i * 3)
        pv.set([(rnd() - 0.5) * 0.08, 0.04 + rnd() * 0.06, (rnd() - 0.5) * 0.04], i * 3)
        life[i] = 1
      }
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
        pt[k + 1] = b * 0.82
        pt[k + 2] = b * 0.4
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
