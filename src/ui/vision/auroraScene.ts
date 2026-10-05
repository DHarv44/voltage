import * as THREE from 'three'
import { countOf } from '../../modules/specs/vision'
import { backdrop, CameraRig, disposeScene, rand, standardCamera, VIEW_H } from './common'
import { ARCTIC_SKY } from './flowerParts'
import type { SceneFactory } from './types'

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
  // up to six curtains; COUNT shows how many (three is the classic sky)
  const meshes: THREE.Mesh[] = []
  const curtains = [0, 1, 2, 3, 4, 5].map((k) => {
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
    // the first three as they always were; extras further back and higher
    mesh.position.set(k < 3 ? (k - 1) * 0.3 : (k - 4) * 0.45 + 0.15, 0.25 + k * 0.08, -0.4 - k * 0.3)
    scene.add(mesh)
    meshes.push(mesh)
    return mat
  })
  const rig = new CameraRig(camera, sky)
  return {
    scene,
    camera,
    aim(cam, dt) {
      if (cam === 1) {
        // ANGLE: lying in the snow, looking up into the curtains
        rig.pos.set(0, -0.7, 1.3)
        rig.at.set(0, 0.8, -0.9)
      } else if (cam === 2) {
        // CLOSE: right up under the nearest curtain
        rig.pos.set(0.25, 0.2, 0.55)
        rig.at.set(-0.1, 0.45, -0.5)
      } else {
        rig.pos.set(0, 0, 3)
        rig.at.set(0, 0, 0)
      }
      rig.apply(cam, dt)
    },
    pick(u, v) {
      // anywhere in the sky: tap for a substorm, drag to push the curtains
      return { x: u, y: 1 - v }
    },
    update(s, _dt, t) {
      sky.material.uniforms.uT.value = t
      const n = countOf.curtains(s.count)
      meshes.forEach((m, k) => (m.visible = k < n))
      curtains.forEach((m, k) => {
        m.uniforms.uT.value = t * (1 + k * 0.15)
        m.uniforms.uAct.value = s.action * Math.max(0.25, 1 - k * 0.2) * (0.5 + s.glow * 0.6)
        m.uniforms.uSway.value = s.sway * Math.max(0.1, 1 - k * 0.3)
        m.uniforms.uColor.value.setHSL((0.36 + (s.hue - 0.55) * 0.6 + k * 0.03 + 1) % 1, 0.85, 0.55)
      })
    },
    dispose() {
      disposeScene(scene)
    },
  }
}
