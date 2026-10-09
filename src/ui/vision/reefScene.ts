import * as THREE from 'three'
import { countOf, REEF, REEF_FISH, REEF_PASS_S } from '../../modules/specs/vision'
import { backdrop, CameraRig, disposeScene, glowPoints, rand, standardCamera, touchPoint, VIEW_H } from './common'
import { Flock, type FlockGoal } from './flock'
import { anemone, brainCoral, seaFan, staghorn } from './reefParts'
import type { SceneFactory } from './types'

const SAND = -0.78

/** Open water: brighter toward the surface, with sun shafts slanting down. */
const SHALLOWS = `
  uniform float uT; uniform float uAspect; uniform vec3 uTint;
  varying vec2 vUv;
  void main(){
    float y = vUv.y;
    vec3 col = mix(uTint * 0.35, uTint * 1.05, smoothstep(0.0, 1.0, y));
    float x = vUv.x * uAspect + y * 0.35;
    float rays = pow(max(0.0, sin(x * 9.0 + uT * 0.15) * sin(x * 4.3 - uT * 0.11 + 1.3)), 6.0);
    col += vec3(0.7, 0.9, 0.85) * rays * 0.25 * smoothstep(0.2, 1.0, y);
    gl_FragColor = vec4(col, 1.0);
  }`

/** The sand: light from the waves above dancing across it (caustics). */
const SAND_FRAG = `
  uniform float uT; uniform float uLight; uniform vec3 uTint; varying vec3 vWorld;
  void main(){
    vec2 p = vWorld.xz * 8.0;
    float c = abs(sin(p.x + uT * 1.1 + sin(p.y * 1.3 + uT * 0.7) * 1.7) * sin(p.y * 1.1 - uT * 0.9 + sin(p.x * 1.2 - uT * 0.5) * 1.9));
    c = pow(1.0 - c, 9.0);
    vec3 sand = vec3(0.78, 0.71, 0.55) * mix(vec3(1.0), uTint * 1.4, 0.35);
    vec3 col = sand * (0.6 + c * 0.35 * uLight);
    float far = smoothstep(2.0, 6.5, length(vWorld - cameraPosition));
    gl_FragColor = vec4(mix(col, uTint * 0.5, far), 1.0);
  }`

/** A sunlit coral reef in the shallows: staghorn and brain corals, sea fans
 *  and an anemone with its clownfish, on sand under moving caustics. The
 *  school is the murmuration's flock in water: each fish follows its
 *  neighbours, wheels when the engine says, and bolts from the barracuda. */
export const reefScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  const tint = new THREE.Color(0.2, 0.55, 0.6)
  const sky = backdrop(aspect, SHALLOWS)
  sky.material.uniforms.uTint = { value: tint }
  scene.add(sky)
  scene.add(new THREE.HemisphereLight(new THREE.Color(0.75, 0.95, 1), new THREE.Color(0.55, 0.45, 0.35), 1.1))
  const sun = new THREE.DirectionalLight(new THREE.Color(1, 0.97, 0.9), 0.9)
  sun.position.set(0.5, 3, 1)
  scene.add(sun)

  const sandMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uLight: { value: 0.7 }, uTint: { value: tint } },
    vertexShader: 'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: SAND_FRAG,
  })
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), sandMat)
  sand.rotation.x = -Math.PI / 2
  sand.position.set(0, SAND, -2)
  scene.add(sand)

  // the reef
  const pal = [new THREE.Color(0.95, 0.45, 0.55), new THREE.Color(0.95, 0.6, 0.25), new THREE.Color(0.65, 0.4, 0.85), new THREE.Color(0.4, 0.75, 0.6)]
  const tips: THREE.Vector3[] = []
  const corals: THREE.MeshLambertMaterial[] = []
  // a band of reef across the view, densest in the middle, some of it close to the glass
  const spot = () => new THREE.Vector3((rnd() - 0.5) * 3.6 * (0.5 + rnd() * 0.5), SAND, -1.4 + rnd() * 1.9)
  for (let k = 0; k < 13; k++) {
    const st = staghorn(rnd, pal[k % pal.length], spot(), 1.1 + rnd() * 1.1)
    scene.add(st.mesh)
    tips.push(...st.tips)
    corals.push(st.mesh.material as THREE.MeshLambertMaterial)
  }
  for (let k = 0; k < 7; k++) {
    const at = spot()
    at.y -= 0.02
    scene.add(brainCoral(rnd, new THREE.Color(0.78, 0.7 - (k % 4) * 0.07, 0.42 + (k % 3) * 0.05), at, 0.13 + rnd() * 0.17))
  }
  const fans = [0, 1, 2, 3].map((k) => seaFan(pal[(k + 2) % pal.length], new THREE.Vector3(-1.5 + k * 1 + rnd() * 0.3, SAND, -1.6 + rnd() * 0.6), 0.45 + rnd() * 0.3, (rnd() - 0.5) * 0.6))
  fans.forEach((f) => scene.add(f.mesh))
  const anemoneAt = new THREE.Vector3(0.45, SAND + 0.02, -0.1)
  const anem = anemone(rnd, new THREE.Color(0.95, 0.75, 0.55), anemoneAt)
  scene.add(anem.mesh)
  const polyps = glowPoints(tips.length, 0.012)
  const pp = polyps.geometry.attributes.position.array as Float32Array
  tips.forEach((p, k) => p.toArray(pp, k * 3))
  scene.add(polyps)

  // the school, the barracuda, two clownfish
  const fishGeo = new THREE.ConeGeometry(0.011, 0.05, 4)
  fishGeo.rotateX(Math.PI / 2)
  const fishMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.75, 0.8, 0.86), emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0 })
  const fish = new THREE.InstancedMesh(fishGeo, fishMat, REEF_FISH)
  fish.frustumCulled = false
  scene.add(fish)
  const fishSize = Float32Array.from({ length: REEF_FISH }, () => 0.8 + rnd() * 0.5)
  const flock = new Flock(REEF_FISH, rnd)
  const cuda = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.42, 8), new THREE.MeshLambertMaterial({ color: new THREE.Color(0.45, 0.5, 0.55) }))
  cuda.rotation.z = Math.PI / 2
  scene.add(cuda)
  const clownMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(1, 0.45, 0.1), emissive: new THREE.Color(0.3, 0.1, 0), emissiveIntensity: 1 })
  const clowns = [0, 1].map(() => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), clownMat)
    c.scale.set(1.6, 1, 0.6)
    scene.add(c)
    return c
  })

  const W = VIEW_H * aspect
  const toX = (x: number) => (x - 0.5) * 2 * W * 0.75
  const toY = (y: number) => SAND + 0.15 + y * 1.3
  const toZ = (z: number) => -1.6 + z * 2
  const goal: FlockGoal = { x: 0, y: 0, z: 0, spread: 0.3, panic: 0, fx: 0, fy: 0, fz: 0, hunting: false, floor: SAND + 0.12, roosting: false }
  const rig = new CameraRig(camera, sky)
  const hit = new THREE.Vector3()
  const m = new THREE.Matrix4()
  const p = new THREE.Vector3()
  const v = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  let turns = -1
  let z = 0.5
  return {
    scene,
    camera,
    aim(dt) {
      rig.pos.set(0, 0.05, 3)
      rig.at.set(0, -0.25, 0)
      rig.apply(dt)
    },
    pick(u, vv) {
      if (!touchPoint(camera, u, vv, toZ(z), hit)) return { x: u, y: 1 - vv }
      return { x: hit.x / (2 * W * 0.75) + 0.5, y: (hit.y - SAND - 0.15) / 1.3 }
    },
    update(s, dt, t, px, led) {
      const surge = led?.[REEF.surge] ?? 0
      const panic = s.action
      z += ((led?.[REEF.z] ?? 0.5) - z) * Math.min(1, dt * 4)
      tint.setHSL((0.5 + (s.hue - 0.55) * 0.4 + 1) % 1, 0.55, 0.42)
      sky.material.uniforms.uT.value = t
      sandMat.uniforms.uT.value = t
      sandMat.uniforms.uLight.value = s.glow
      for (const f of fans) {
        f.uniforms.uSurge.value = surge
        f.uniforms.uT.value = t
      }
      anem.uniforms.uSurge.value = surge
      anem.uniforms.uT.value = t
      anem.uniforms.uShrink.value = panic // it pulls in when the fish panic
      // feeding polyps glow at the branch tips
      const polypsOpen = led?.[REEF.polyps] ?? 0.3
      const pt = polyps.geometry.attributes.tint.array as Float32Array
      for (let k = 0; k < tips.length; k++) {
        const b = polypsOpen * (0.5 + 0.5 * Math.sin(t * 1.7 + k))
        pt[k * 3] = b * 0.9
        pt[k * 3 + 1] = b
        pt[k * 3 + 2] = b * 0.6
      }
      polyps.geometry.attributes.tint.needsUpdate = true
      polyps.material.uniforms.uPx.value = px
      for (const c of corals) c.emissiveIntensity = polypsOpen * 0.15

      // the barracuda's pass, or a finger's scare
      const pass = led?.[REEF.pass] ?? -1
      const scare = led?.[REEF.scare] ?? 0
      cuda.visible = pass >= 0
      if (pass >= 0) {
        const dir = led?.[REEF.bdir] ?? 1
        cuda.position.set(toX(led?.[REEF.bx] ?? 0), toY(led?.[REEF.by] ?? 0.5), toZ(z))
        goal.fx = cuda.position.x + dir * 0.2
        goal.fy = cuda.position.y
        goal.fz = cuda.position.z
      } else if (scare > 0) {
        goal.fx = toX(led?.[REEF.sx] ?? 0.5)
        goal.fy = toY(led?.[REEF.sy] ?? 0.5)
        goal.fz = toZ(z)
      }
      goal.hunting = (pass >= 0 && pass < REEF_PASS_S) || scare > 0
      goal.x = toX(s.x)
      goal.y = toY(s.y)
      goal.z = toZ(z)
      goal.spread = led?.[REEF.spread] ?? 0.3
      goal.panic = panic
      const tn = led?.[REEF.turns] ?? 0
      if (turns >= 0 && tn !== turns) flock.startWave(led?.[REEF.turnDir] ?? 1)
      turns = tn
      const n = countOf.fish(s.count)
      flock.step(Math.min(dt, 1 / 30), n, goal, camera.position.x, camera.position.z)
      fish.count = n
      for (let i = 0; i < n; i++) {
        p.fromArray(flock.pos, i * 3)
        v.fromArray(flock.vel, i * 3)
        m.lookAt(p, v.multiplyScalar(-1).add(p), up)
        m.scale(v.setScalar(fishSize[i]))
        m.setPosition(p)
        fish.setMatrixAt(i, m)
      }
      fish.instanceMatrix.needsUpdate = true
      fishMat.emissiveIntensity = panic * 0.35 // silver flashes as they bolt
      // clownfish keep to their anemone (and dive into it when frightened)
      clowns.forEach((c, k) => {
        const hide = Math.min(1, panic * 1.5)
        c.position.set(
          anemoneAt.x + Math.sin(t * 1.3 + k * 2.1) * 0.07 * (1 - hide * 0.7),
          anemoneAt.y + 0.1 - hide * 0.07 + Math.sin(t * 2.2 + k) * 0.015,
          anemoneAt.z + Math.cos(t * 1.1 + k * 2.1) * 0.05,
        )
        c.rotation.y = Math.atan2(Math.cos(t * 1.3 + k * 2.1), -Math.sin(t * 1.1 + k * 2.1))
      })
    },
    dispose() {
      disposeScene(scene)
    },
  }
}
