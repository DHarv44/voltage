import * as THREE from 'three'
import { countOf, MUR, STARLINGS } from '../../modules/specs/vision'
import { backdrop, CameraRig, disposeScene, rand, smooth, standardCamera, touchPoint, VIEW_H } from './common'
import { Flock, type FlockGoal } from './flock'
import type { SceneFactory } from './types'

/** A sunset over the reeds: the glow (tinted by PITCH) fades with the dusk. */
const SUNSET_SKY = `
  uniform float uT; uniform float uAspect; uniform float uDusk; uniform vec3 uGlow;
  varying vec2 vUv;
  void main(){
    float y = vUv.y;
    vec3 low = mix(uGlow, vec3(0.32, 0.14, 0.2), uDusk);
    vec3 mid = mix(vec3(0.86, 0.52, 0.48), vec3(0.16, 0.1, 0.22), uDusk);
    vec3 high = mix(vec3(0.34, 0.44, 0.68), vec3(0.04, 0.05, 0.13), uDusk);
    vec3 col = mix(low, mid, smoothstep(0.18, 0.45, y));
    col = mix(col, high, smoothstep(0.45, 0.98, y));
    // the sun, sinking behind the reeds
    vec2 sp = vec2((vUv.x - 0.7) * uAspect, y - 0.2 + uDusk * 0.1);
    float d = length(sp);
    col += vec3(1.0, 0.72, 0.42) * (exp(-d * d * 900.0) * (1.0 - uDusk) + exp(-d * 6.0) * 0.35 * (1.0 - uDusk * 0.8));
    gl_FragColor = vec4(col, 1.0);
  }`

const REED_VERT = `
  uniform float uT; uniform float uWind;
  varying float vUp;
  void main(){
    vUp = uv.y;
    vec4 p = instanceMatrix * vec4(position, 1.0);
    // the tops bend with the wind, each reed a little out of step
    p.x += (sin(uT * 1.3 + p.z * 4.0 + p.x * 3.0) * 0.012 + uWind * 0.03) * uv.y * uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * p;
  }`
const REED_FRAG = `
  uniform vec3 uInk; varying float vUp;
  void main(){ gl_FragColor = vec4(uInk * (0.6 + vUp * 0.5), 1.0); }`

const BIRD_VERT = `
  attribute float look; uniform float uSize; uniform float uPx;
  varying float vFar;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFar = clamp((-mv.z - 2.0) / 3.5, 0.0, 1.0);
    gl_PointSize = look > 0.0 ? max(2.0, uSize * look * uPx / (-mv.z * 0.63)) : 0.0;
    gl_Position = projectionMatrix * mv;
  }`
const BIRD_FRAG = `
  uniform vec3 uInk; uniform vec3 uHaze; uniform float uFade;
  varying float vFar;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    // a bird is wider than it is tall
    float a = smoothstep(0.42, 0.25, length(vec2(d.x, d.y * 2.2)));
    if (a < 0.02) discard;
    gl_FragColor = vec4(mix(uInk, uHaze, vFar * 0.6), a * uFade);
  }`

/** Starlings at dusk over a reed bed. The engine says where the flock is
 *  heading, how tight, when a wave turns it and where the falcon dives; each
 *  bird here only follows its neighbours (see Flock), so the shapes and the
 *  dark ripples are the flock's own. Reeds stand in 3D, so zooming finds them. */
export const murmurationScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  const sky = backdrop(aspect, SUNSET_SKY)
  sky.material.uniforms.uDusk = { value: 0 }
  sky.material.uniforms.uGlow = { value: new THREE.Color(1, 0.55, 0.25) }
  scene.add(sky)
  const W = VIEW_H * aspect
  const ground = -VIEW_H * 0.78
  const toX = (x: number) => (x - 0.5) * 2 * W * 0.85
  const toY = (y: number) => ground + 0.1 + y * VIEW_H * 1.6
  const toZ = (z: number) => -2.2 + z * 2.4

  // the reed bed: thin blades from far behind to just in front of the glass
  const ink = new THREE.Color(0.06, 0.05, 0.06)
  const reedMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uWind: { value: 0 }, uInk: { value: ink } }, vertexShader: REED_VERT, fragmentShader: REED_FRAG, side: THREE.DoubleSide })
  const reedGeo = new THREE.PlaneGeometry(0.006, 1, 1, 4)
  reedGeo.translate(0, 0.5, 0)
  const REEDS = 2600
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, REEDS)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const sc = new THREE.Vector3()
  const at = new THREE.Vector3()
  for (let k = 0; k < REEDS; k++) {
    const z = -4.5 + rnd() * 5.2
    at.set((rnd() * 2 - 1) * W * (1.4 + (0.6 - z) * 0.5), ground, z)
    e.set((rnd() - 0.5) * 0.15, rnd() * Math.PI, (rnd() - 0.5) * 0.25)
    sc.set(1 + rnd(), 0.12 + rnd() * 0.16, 1)
    reeds.setMatrixAt(k, m.compose(at, q.setFromEuler(e), sc))
  }
  reeds.frustumCulled = false
  scene.add(reeds)
  // the marsh: wet ground holding a little of the sunset, darker nearer the glass
  const marsh = new THREE.ShaderMaterial({
    uniforms: { uGlow: sky.material.uniforms.uGlow, uDusk: sky.material.uniforms.uDusk },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uGlow; uniform float uDusk; varying vec2 vUv;
      void main(){
        float far = smoothstep(0.35, 1.0, vUv.y);
        gl_FragColor = vec4(mix(vec3(0.03, 0.025, 0.035), uGlow * 0.32 * (1.0 - uDusk * 0.85), far), 1.0);
      }`,
  })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 8, 6), marsh)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, ground, -1.5)
  scene.add(floor)

  // the birds, and the falcon
  const flock = new Flock(STARLINGS, rnd)
  const birdGeo = new THREE.BufferGeometry()
  birdGeo.setAttribute('position', new THREE.BufferAttribute(flock.pos, 3))
  birdGeo.setAttribute('look', new THREE.BufferAttribute(new Float32Array(STARLINGS), 1))
  const birdMat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 0.032 }, uPx: { value: 300 }, uInk: { value: new THREE.Color(0.02, 0.015, 0.025) }, uHaze: { value: new THREE.Color(0.3, 0.2, 0.25) }, uFade: { value: 1 } },
    vertexShader: BIRD_VERT,
    fragmentShader: BIRD_FRAG,
    transparent: true,
    depthWrite: false,
  })
  const birds = new THREE.Points(birdGeo, birdMat)
  birds.frustumCulled = false
  scene.add(birds)
  const falconGeo = new THREE.BufferGeometry()
  falconGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
  falconGeo.setAttribute('look', new THREE.BufferAttribute(new Float32Array([0]), 1))
  const falconMat = birdMat.clone()
  falconMat.uniforms.uSize.value = 0.05
  const falcon = new THREE.Points(falconGeo, falconMat)
  falcon.frustumCulled = false
  scene.add(falcon)

  const goal: FlockGoal = { x: 0, y: 0, z: 0, spread: 0.32, panic: 0, fx: 0, fy: 0, fz: 0, hunting: false, floor: ground + 0.28, roosting: false }
  const rig = new CameraRig(camera, sky)
  const hit = new THREE.Vector3()
  let waves = -1
  let z = 0.5
  let spread = 0.32
  return {
    scene,
    camera,
    aim(dt) {
      rig.pos.set(0, 0, 3)
      rig.at.set(0, 0, 0)
      rig.apply(dt)
    },
    pick(u, v) {
      // a finger on the sky, at the flock's depth
      if (!touchPoint(camera, u, v, toZ(z), hit)) return { x: u, y: 1 - v }
      return { x: hit.x / (2 * W * 0.85) + 0.5, y: (hit.y - ground - 0.1) / (VIEW_H * 1.6) }
    },
    update(s, dt, t, px, led) {
      const dusk = led?.[MUR.dusk] ?? 0
      const k = Math.min(1, dt * 4)
      z += ((led?.[MUR.z] ?? 0.5) - z) * k
      spread += ((led?.[MUR.spread] ?? 0.32) - spread) * k
      sky.material.uniforms.uT.value = t
      sky.material.uniforms.uDusk.value = dusk
      sky.material.uniforms.uGlow.value.setHSL((0.06 + (s.hue - 0.55) * 0.5 + 1) % 1, 0.95, 0.58)
      reedMat.uniforms.uT.value = t
      reedMat.uniforms.uWind.value = s.sway
      const ago = led?.[MUR.falcon] ?? -1
      goal.x = toX(s.x)
      goal.y = toY(s.y)
      goal.z = toZ(z)
      goal.spread = spread
      goal.panic = s.action
      goal.hunting = ago >= 0
      goal.roosting = dusk > 0.85
      if (goal.hunting) {
        // the stoop: in from high on the left, through the target, out low to the right
        const u = Math.min(1, ago / 2.5)
        const tx = toX(led?.[MUR.fx] ?? 0.5)
        const ty = toY(led?.[MUR.fy] ?? 0.6)
        const sx = tx - 0.7
        const sy = ty + 1.1
        const ex = tx + 0.9
        const ey = ty - 0.2
        const cxp = 2 * tx - (sx + ex) / 2
        const cyp = 2 * ty - (sy + ey) / 2
        goal.fx = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cxp + u * u * ex
        goal.fy = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cyp + u * u * ey
        goal.fz = goal.z
      }
      const w = led?.[MUR.waves] ?? 0
      if (waves >= 0 && w !== waves) flock.startWave(led?.[MUR.waveDir] ?? 1)
      waves = w
      const n = countOf.starlings(s.count)
      flock.step(Math.min(dt, 1 / 30), n, goal, camera.position.x, camera.position.z)
      const look = birdGeo.attributes.look.array as Float32Array
      look.set(flock.look)
      look.fill(0, n)
      birdGeo.attributes.position.needsUpdate = true
      birdGeo.attributes.look.needsUpdate = true
      // roosted: down among the reeds, out of sight until the next evening
      birdMat.uniforms.uFade.value = 1 - smooth(0.96, 1, dusk)
      birdMat.uniforms.uPx.value = px
      falconMat.uniforms.uPx.value = px
      const fp = falconGeo.attributes.position.array as Float32Array
      fp[0] = goal.fx
      fp[1] = goal.fy
      fp[2] = goal.fz
      ;(falconGeo.attributes.look.array as Float32Array)[0] = goal.hunting ? 1 : 0
      falconGeo.attributes.position.needsUpdate = true
      falconGeo.attributes.look.needsUpdate = true
    },
    dispose() {
      disposeScene(scene)
    },
  }
}
