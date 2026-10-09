import * as THREE from 'three'
import { countOf, DROPS, POND, RAIN, ripple } from '../../modules/specs/vision'
import { backdrop, CameraRig, disposeScene, glowPoints, rand, standardCamera } from './common'
import type { SceneFactory } from './types'

const WATER_Y = -0.5
/** Pond space (0..1 across, 0 far … 1 near) → the scene. */
const toX = (x: number) => (x - 0.5) * POND.w
const toZ = (z: number) => 0.6 - (1 - z) * POND.d
const STREAKS = 700

const OVERCAST = `
  uniform float uT; uniform float uAspect; uniform float uFlash; uniform vec3 uTint;
  varying vec2 vUv;
  void main(){
    float y = vUv.y;
    vec3 col = mix(uTint * 0.6, uTint * 0.28, smoothstep(0.3, 1.0, y));
    // low cloud rolling over
    float c = sin(vUv.x * uAspect * 3.0 + uT * 0.05 + sin(y * 7.0 + uT * 0.03) * 1.5) * 0.5 + 0.5;
    col *= 0.85 + 0.25 * c * smoothstep(0.35, 0.9, y);
    col += vec3(0.8, 0.85, 1.0) * uFlash * 0.9 * smoothstep(0.2, 1.0, y);
    gl_FragColor = vec4(col, 1.0);
  }`

/** The water: every ring's slope summed (the same ripple() as the engine's,
 *  differentiated), lighting a reflection of the sky. */
const WATER_FRAG = `
  uniform vec4 uDrops[${DROPS}];
  uniform float uT; uniform float uWind; uniform float uFlash; uniform vec3 uTint;
  varying vec3 vWorld;
  void main(){
    vec2 p = vWorld.xz;
    vec2 g = vec2(0.0);
    for (int k = 0; k < ${DROPS}; k++) {
      vec4 d = uDrops[k];
      if (d.w <= 0.0) continue;
      vec2 dp = p - d.xy;
      float r = length(dp) + 1e-4;
      float u = r - ${POND.speed.toFixed(3)} * d.z;
      if (u > 0.0) continue;
      float amp = d.w * exp(-d.z / ${POND.fade.toFixed(3)}) / (1.0 + r * 3.0);
      float K = ${POND.k.toFixed(1)};
      g += amp * exp(u * 2.0) * (K * cos(u * K) + 2.0 * sin(u * K)) * dp / r;
    }
    // the wind ruffling the surface
    g += uWind * 0.6 * vec2(sin(p.x * 31.0 + uT * 3.1) * sin(p.y * 17.0 - uT), cos(p.y * 27.0 + uT * 2.3) * sin(p.x * 13.0 + uT));
    vec3 n = normalize(vec3(-g.x * 0.008, 1.0, -g.y * 0.008));
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 r = reflect(-view, n);
    float fres = 0.08 + 0.92 * pow(1.0 - max(dot(n, view), 0.0), 5.0);
    vec3 sky = mix(uTint * 0.6, uTint * 0.3, clamp(r.y * 1.5, 0.0, 1.0)) * (1.0 + uFlash * 2.5);
    // the bright patch of cloud beyond the pond, caught by every ring
    float glint = pow(max(dot(r, normalize(vec3(0.2, 0.35, -1.0))), 0.0), 18.0);
    vec3 col = mix(vec3(0.02, 0.05, 0.06), sky, fres) + uTint * glint * (0.55 + uFlash);
    float far = smoothstep(2.5, 7.0, length(vWorld - cameraPosition));
    gl_FragColor = vec4(mix(col, uTint * 0.5, far), 1.0);
  }`

/** Rain on a pond, seen from the bank. The engine says where each drop lands
 *  and the water here draws the same rings it uses for the lily pad, so what
 *  you see bobbing is what comes out of MOTION. */
export const rainScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  const sky = backdrop(aspect, OVERCAST)
  const tint = new THREE.Color(0.5, 0.56, 0.62)
  sky.material.uniforms.uFlash = { value: 0 }
  sky.material.uniforms.uTint = { value: tint }
  scene.add(sky)

  const drops = Array.from({ length: DROPS }, () => new THREE.Vector4())
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.ShaderMaterial({
      uniforms: { uDrops: { value: drops }, uT: { value: 0 }, uWind: { value: 0 }, uFlash: sky.material.uniforms.uFlash, uTint: { value: tint } },
      vertexShader: 'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: WATER_FRAG,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(0, WATER_Y, -2)
  scene.add(water)

  // the far bank: a dark line of trees across the water
  const treeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 0.09, 0.07) })
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 1, 7), treeMat, 90)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const at = new THREE.Vector3()
  const sc = new THREE.Vector3()
  for (let k = 0; k < 90; k++) {
    const h = 0.22 + rnd() * 0.4
    at.set(-6 + rnd() * 12, WATER_Y + h / 2, -4.3 - rnd() * 1.4)
    sc.set(0.7 + rnd() * 0.8, h, 0.7 + rnd() * 0.8)
    trees.setMatrixAt(k, m.compose(at, q, sc))
  }
  scene.add(trees)
  const bank = new THREE.Mesh(new THREE.PlaneGeometry(14, 2), treeMat)
  bank.rotation.x = -Math.PI / 2
  bank.position.set(0, WATER_Y + 0.002, -5)
  scene.add(bank)

  // lily pads (pad 0 is the engine's, whose bob is MOTION)
  const padMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.17, 0.33, 0.13), side: THREE.DoubleSide })
  const pads = Array.from({ length: 7 }, (_, k) => {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.11 + rnd() * 0.08, 28, 0.25, Math.PI * 2 - 0.25), padMat)
    mesh.rotation.set(-Math.PI / 2, 0, rnd() * Math.PI * 2)
    const x = k === 0 ? POND.padX : 0.12 + rnd() * 0.76
    const z = k === 0 ? POND.padZ : 0.15 + rnd() * 0.75
    mesh.position.set(toX(x), WATER_Y + 0.003, toZ(z))
    scene.add(mesh)
    return { mesh, x, z }
  })

  // the rain itself, and a little crown where each drop lands
  const streakGeo = new THREE.BufferGeometry()
  const sp = new Float32Array(STREAKS * 6)
  const fall = Array.from({ length: STREAKS }, () => ({ x: (rnd() - 0.5) * 6, y: WATER_Y + rnd() * 2.4, z: -3.5 + rnd() * 4.4, v: 5 + rnd() * 2 }))
  streakGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(0.75, 0.8, 0.86), transparent: true, opacity: 0.35 }))
  streaks.frustumCulled = false
  scene.add(streaks)
  const crowns = glowPoints(DROPS, 0.05)
  scene.add(crowns)

  const lastId = new Float32Array(DROPS).fill(-1)
  const born = new Float32Array(DROPS).fill(-99)
  const sizes = new Float32Array(DROPS)
  const rig = new CameraRig(camera, sky)
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const surface = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y)
  const hit = new THREE.Vector3()
  let first = true
  return {
    scene,
    camera,
    aim(dt) {
      rig.pos.set(0, 0.45, 3.2)
      rig.at.set(0, -0.45, -1.2)
      rig.apply(dt)
    },
    pick(u, v) {
      // where the finger meets the water, in pond space
      ndc.set(u * 2 - 1, 1 - v * 2)
      ray.setFromCamera(ndc, camera)
      if (!ray.ray.intersectPlane(surface, hit)) return { x: u, y: 0 }
      return { x: Math.max(0, Math.min(1, hit.x / POND.w + 0.5)), y: Math.max(0, Math.min(1, 1 + (hit.z - 0.6) / POND.d)) }
    },
    update(s, dt, t, px, led) {
      const flash = led?.[RAIN.flash] ?? 0
      const heavy = led?.[RAIN.heavy] ?? 5
      tint.setHSL((0.58 + (s.hue - 0.55) * 0.5 + 1) % 1, 0.18, 0.62)
      sky.material.uniforms.uT.value = t
      sky.material.uniforms.uFlash.value = flash
      const wu = water.material.uniforms
      wu.uT.value = t
      wu.uWind.value = Math.abs(s.sway) * 0.2 + heavy * 0.004
      // new drops start their rings now (ones already on the water when we arrived are left out)
      const cp = crowns.geometry.attributes.position.array as Float32Array
      const ct = crowns.geometry.attributes.tint.array as Float32Array
      for (let k = 0; k < DROPS; k++) {
        const b = RAIN.drops + k * 4
        const id = led?.[b + 3] ?? 0
        if (id !== lastId[k]) {
          lastId[k] = id
          born[k] = first ? -99 : t
        }
        sizes[k] = led?.[b + 2] ?? 0
        const age = t - born[k]
        const x = toX(led?.[b] ?? 0)
        const z = toZ(led?.[b + 1] ?? 0)
        drops[k].set(x, z, age, age < 8 ? sizes[k] : 0)
        const c = age < 0.18 ? Math.sin((age / 0.18) * Math.PI) * sizes[k] : 0
        cp[k * 3] = x
        cp[k * 3 + 1] = WATER_Y + c * 0.05
        cp[k * 3 + 2] = z
        ct[k * 3] = ct[k * 3 + 1] = ct[k * 3 + 2] = c * 0.8
      }
      first = false
      crowns.geometry.attributes.position.needsUpdate = true
      crowns.geometry.attributes.tint.needsUpdate = true
      crowns.material.uniforms.uPx.value = px
      // the pads ride the rings
      const n = countOf.pads(s.count)
      pads.forEach((p, k) => {
        p.mesh.visible = k < n
        let h = 0
        for (let j = 0; j < DROPS; j++) {
          if (drops[j].w <= 0) continue
          h += ripple(Math.hypot(toX(p.x) - drops[j].x, toZ(p.z) - drops[j].y), drops[j].z, drops[j].w)
        }
        p.mesh.position.y = WATER_Y + 0.003 + h * 0.015
      })
      // streaks: as many as the rain is heavy, slanting with the wind
      const shown = Math.min(STREAKS, Math.round(heavy * 25))
      const slant = s.sway * 0.03
      for (let k = 0; k < STREAKS; k++) {
        const f = fall[k]
        f.y -= f.v * dt
        f.x += slant * f.v * dt
        if (f.y < WATER_Y) {
          f.y += 2.4
          f.x = (rnd() - 0.5) * 6
        }
        const o = k * 6
        const vis = k < shown ? 1 : 0
        sp[o] = f.x
        sp[o + 1] = f.y
        sp[o + 2] = f.z
        sp[o + 3] = f.x - slant * 0.08 * vis
        sp[o + 4] = f.y + 0.09 * vis
        sp[o + 5] = f.z
      }
      streakGeo.attributes.position.needsUpdate = true
    },
    dispose() {
      disposeScene(scene)
    },
  }
}
