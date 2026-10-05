import * as THREE from 'three'
import { FIREFLIES, VS_EXTRA } from '../../modules/specs/vision'
import { backdrop, disposeScene, glowPoints, rand, standardCamera, VIEW_H } from './common'
import { ARCTIC_SKY, MEADOW_SKY } from './flowerParts'
import type { SceneFactory } from './types'

/** Fireflies drifting over a meadow; each flashes when the engine says so. */
export const firefliesScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  const sky = backdrop(aspect, MEADOW_SKY)
  scene.add(sky)
  const core = glowPoints(FIREFLIES, 0.045)
  const halo = glowPoints(FIREFLIES, 0.22)
  scene.add(halo, core)
  // each fly's own lazy figure-of-eight through the grass
  const path = Array.from({ length: FIREFLIES }, () => ({ x: rnd() * 2 - 1, y: rnd(), fx: 0.05 + rnd() * 0.12, fy: 0.07 + rnd() * 0.15, ph: rnd() * 10, z: rnd() * 0.8 - 0.4 }))
  const W = VIEW_H * aspect
  const col = new THREE.Color()
  return {
    scene,
    camera,
    update(s, _dt, t, px, led) {
      sky.material.uniforms.uT.value = t
      const cp = core.geometry.attributes.position.array as Float32Array
      const ct = core.geometry.attributes.tint.array as Float32Array
      const hp = halo.geometry.attributes.position.array as Float32Array
      const ht = halo.geometry.attributes.tint.array as Float32Array
      col.setHSL((0.17 + (s.hue - 0.55) * 0.3 + 1) % 1, 0.9, 0.6)
      for (let k = 0; k < FIREFLIES; k++) {
        const p = path[k]
        const x = p.x * W * 0.85 + Math.sin(t * p.fx + p.ph) * 0.25 + s.sway * 0.05
        const y = -VIEW_H * 0.6 + p.y * VIEW_H * 1.1 + Math.sin(t * p.fy * 2 + p.ph) * 0.12
        const b = (led?.[VS_EXTRA + k] ?? 0) * 1.6
        for (const [pos, tint, gain] of [
          [cp, ct, 1],
          [hp, ht, 0.35],
        ] as const) {
          pos[k * 3] = x
          pos[k * 3 + 1] = y
          pos[k * 3 + 2] = p.z
          tint[k * 3] = col.r * b * gain + 0.02
          tint[k * 3 + 1] = col.g * b * gain + 0.02
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

const CURTAIN = `
  uniform float uT; uniform float uAct; uniform float uSway; uniform float uSeed; uniform vec3 uColor;
  varying vec2 vUv;
  void main(){
    float x = vUv.x * 9.0 + uSeed;
    // vertical rays drifting along the curtain
    float rays = 0.55 + 0.45 * sin(x * 3.1 + uT * 0.7) * sin(x * 7.3 - uT * 1.1 + uSeed);
    float fadeUp = pow(1.0 - vUv.y, 1.3) * smoothstep(0.0, 0.08, vUv.y);
    vec3 top = vec3(0.6, 0.25, 0.75);
    vec3 col = mix(uColor, top, smoothstep(0.35, 1.0, vUv.y));
    float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
    gl_FragColor = vec4(col * rays * fadeUp * edge * (0.15 + uAct * 1.1), 1.0);
  }`

/** Aurora curtains over snowy hills. Each curtain is a ribbon that waves
 *  along its length; activity brightens it and lifts it higher. */
export const auroraScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  const sky = backdrop(aspect, ARCTIC_SKY)
  scene.add(sky)
  const curtains = [0, 1, 2].map((k) => {
    const geo = new THREE.PlaneGeometry(VIEW_H * aspect * 2.2, 1, 90, 1)
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uAct: { value: 0 }, uSway: { value: 0 }, uSeed: { value: rnd() * 10 }, uColor: { value: new THREE.Color() } },
      vertexShader: `
        uniform float uT; uniform float uSway; uniform float uSeed; uniform float uAct;
        varying vec2 vUv;
        void main(){
          vUv = uv;
          vec3 p = position;
          float w = sin(p.x * 1.7 + uT * 0.3 + uSeed) * 0.25 + sin(p.x * 4.1 - uT * 0.5 + uSeed * 2.0) * 0.08;
          p.z += w + uSway * 0.3;
          p.y += (uv.y) * uAct * 0.35 + sin(p.x * 2.3 + uT * 0.4 + uSeed) * 0.06;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: CURTAIN,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set((k - 1) * 0.3, 0.25 + k * 0.08, -0.4 - k * 0.3)
    scene.add(mesh)
    return mat
  })
  return {
    scene,
    camera,
    update(s, _dt, t) {
      sky.material.uniforms.uT.value = t
      curtains.forEach((m, k) => {
        m.uniforms.uT.value = t * (1 + k * 0.15)
        m.uniforms.uAct.value = s.action * (1 - k * 0.2) * (0.5 + s.glow * 0.6)
        m.uniforms.uSway.value = s.sway * (1 - k * 0.3)
        m.uniforms.uColor.value.setHSL((0.36 + (s.hue - 0.55) * 0.6 + k * 0.03 + 1) % 1, 0.85, 0.55)
      })
    },
    dispose() {
      disposeScene(scene)
    },
  }
}

const GRAINS = 2500

/** A Chladni plate: sand shaken off the moving parts collects on the still
 *  lines of the current mode. */
export const cymaticsScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0.06, 0.06, 0.07)
  const camera = standardCamera(aspect)
  const S = VIEW_H * 0.92
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(S * 2, S * 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.15, 0.14) }),
  )
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
  // mode shape: how much the plate moves at (x, y) — square plates have both
  // the symmetric (+) and antisymmetric (−) combinations
  const amp = (x: number, y: number) => Math.cos(n * PI * x) * Math.cos(m * PI * y) + sign * Math.cos(m * PI * x) * Math.cos(n * PI * y)
  const sandCol = new THREE.Color()
  return {
    scene,
    camera,
    update(s, _dt, _t, px, led) {
      m = led?.[VS_EXTRA] ?? 1
      n = led?.[VS_EXTRA + 1] ?? 2
      sign = (led?.[VS_EXTRA + 2] ?? 0) % 2 === 0 ? -1 : 1
      const drive = s.action
      const pos = sand.geometry.attributes.position.array as Float32Array
      const tint = sand.geometry.attributes.tint.array as Float32Array
      sandCol.setHSL(s.hue, 0.25, 0.75)
      const e = 0.004
      for (let i = 0; i < GRAINS; i++) {
        const a = amp(u[i], v[i])
        const shake = Math.abs(a) * drive * 0.02
        // bounce randomly where it moves, and slide downhill toward the still lines
        const gx = (amp(u[i] + e, v[i]) ** 2 - a * a) / e
        const gy = (amp(u[i], v[i] + e) ** 2 - a * a) / e
        u[i] = Math.min(1, Math.max(0, u[i] + (rnd() - 0.5) * shake - gx * 0.0006 * drive))
        v[i] = Math.min(1, Math.max(0, v[i] + (rnd() - 0.5) * shake - gy * 0.0006 * drive))
        pos[i * 3] = (u[i] * 2 - 1) * S
        pos[i * 3 + 1] = (v[i] * 2 - 1) * S
        pos[i * 3 + 2] = 0
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
