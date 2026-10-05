import * as THREE from 'three'
import { countOf, JELLY_PITCH, JELLY_Z } from '../../modules/specs/vision'
import { backdrop, CameraRig, disposeScene, glowPoints, rand, standardCamera, touchPoint, VIEW_H } from './common'
import { JellyBody, type JellyPose } from './jellyBody'
import type { SceneFactory } from './types'

/** Marine snow allocated; COUNT thins it below halfway. */
const SNOW = 220
/** Jellies allocated: the engine's one, plus up to five companions (COUNT). */
const JELLIES = 6
/** The tank's depth in world units: back wall … front glass (camera at z = 3). */
const Z_BACK = -1.0
const Z_FRONT = 0.6
const CAM_Z = 3
/** Seconds of the lead jelly's pulse remembered (companions echo it late). */
const ECHO = 2

const WATER = `
  uniform float uT; varying vec2 vUv;
  void main(){
    vec3 deep = vec3(0.0, 0.012, 0.03);
    vec3 shallow = vec3(0.01, 0.07, 0.11);
    vec3 col = mix(deep, shallow, pow(vUv.y, 1.6));
    float shafts = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      shafts += pow(0.5 + 0.5 * sin(vUv.x * (7.0 + fi * 3.1) + vUv.y * (1.5 + fi) + uT * (0.07 + fi * 0.03) + fi * 2.0), 8.0);
    }
    col += vec3(0.05, 0.13, 0.16) * shafts * pow(vUv.y, 2.2) * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }`

/** A companion's own drift through the tank (a slow 3D Lissajous), its size,
 *  colour offset and how late it echoes the lead jelly's pulse. */
interface Companion {
  fx: number
  fy: number
  fz: number
  ph: number
  size: number
  hue: number
  delay: number
}

/** Bioluminescent jellyfish in a dark tank, drifting in marine snow. It roams
 *  the tank's depth too: perspective shrinks it toward the back wall, the water
 *  dims it, and it passes in front of and behind the snow. COUNT above halfway
 *  adds companions (a smack) that drift on their own and pulse in loose
 *  sympathy with the lead one, which is the jelly the engine and jacks follow. */
export const jellyScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  const bg = backdrop(aspect, WATER)
  scene.add(bg)

  const halfW = VIEW_H * aspect * 0.8
  const halfH = VIEW_H * 0.8

  // Marine snow: drifting specks lit faintly by the jelly.
  const snow = glowPoints(SNOW, 0.016)
  const sp = snow.geometry.attributes.position.array as Float32Array
  const st = snow.geometry.attributes.tint.array as Float32Array
  for (let i = 0; i < SNOW; i++) {
    sp[i * 3] = (rnd() * 2 - 1) * VIEW_H * aspect
    sp[i * 3 + 1] = (rnd() * 2 - 1) * VIEW_H
    sp[i * 3 + 2] = -1.8 + rnd() * 2.8 // deep enough to fill the ANGLE camera too
  }
  scene.add(snow)

  const jellies = Array.from({ length: JELLIES }, () => new JellyBody(scene, rnd))
  const mates: Companion[] = Array.from({ length: JELLIES - 1 }, () => ({
    fx: 0.03 + rnd() * 0.04,
    fy: 0.04 + rnd() * 0.05,
    fz: 0.02 + rnd() * 0.04,
    ph: rnd() * 20,
    size: 0.65 + rnd() * 0.45,
    hue: (rnd() - 0.5) * 0.12,
    delay: 0.2 + rnd() * 1.4,
  }))
  // the lead jelly's recent contraction, so companions can echo it late
  const echo = new Float32Array(120)
  let echoAt = 0
  let echoT = 0

  const pose: JellyPose = { pos: new THREE.Vector3(), pitch: 0, tilt: 0, yaw: 0, R: 0.15, action: 0, glow: 0, color: new THREE.Color(), sway: 0 }
  const lead = new THREE.Vector3()
  const leadColor = new THREE.Color()
  const phase = rnd() * 10
  let depth = 0.5
  let pitch = 0
  let reach = 1
  const rig = new CameraRig(camera, bg)
  const zMid = (Z_BACK + Z_FRONT) / 2
  const hit = new THREE.Vector3()

  /** A spot in the tank (0..1 across, up, deep) → world, inside the glass. */
  const place = (x: number, y: number, d: number, out: THREE.Vector3) => {
    const z = Z_BACK + d * (Z_FRONT - Z_BACK)
    const r = (CAM_Z - z) / CAM_Z
    return out.set((x - 0.5) * 2 * halfW * r, (y - 0.5) * 2 * halfH * r, z)
  }

  return {
    scene,
    camera,
    aim(cam, dt) {
      const p = lead
      if (cam === 1) {
        // ANGLE: through the tank's end wall; depth runs across the screen
        rig.pos.set(3.2, 0, zMid)
        rig.at.set(0, 0, zMid)
      } else if (cam === 2) {
        // CLOSE: just in front of the (lead) jelly, following it
        rig.pos.set(p.x * 0.85, p.y * 0.85 + 0.05, Math.min(CAM_Z - 0.1, p.z + 1.3))
        rig.at.copy(p)
      } else {
        rig.pos.set(0, 0, CAM_Z)
        rig.at.set(0, 0, 0)
      }
      rig.apply(cam, dt)
    },
    pick(u, v) {
      // on the plane facing the camera through the lead jelly, in tank units
      if (!touchPoint(camera, u, v, lead, hit)) return { x: -1, y: -1 }
      return { x: 0.5 + hit.x / (2 * halfW * reach), y: 0.5 + hit.y / (2 * halfH * reach) }
    },
    update(s, dt, t, px, led) {
      bg.material.uniforms.uT.value = t
      const k = 1 - Math.exp(-dt / 0.05)
      depth += ((led?.[JELLY_Z] ?? 0.5) - depth) * k
      pitch += ((led?.[JELLY_PITCH] ?? 0) - pitch) * k

      // The lead jelly: the engine's creature. Its x/y span the tank's walls at
      // its own depth, so it stays inside the glass wherever it swims; far back
      // the water swallows its light.
      place(s.x, s.y, depth, lead)
      reach = (CAM_Z - lead.z) / CAM_Z
      const glow = Math.min(1.5, s.glow)
      pose.pos.copy(lead)
      pose.pitch = pitch
      pose.tilt = s.tilt
      pose.yaw = Math.sin(t * 0.15 + phase) * 0.4
      pose.R = 0.15 * (0.55 + 0.9 * s.grow)
      pose.action = s.action
      pose.glow = glow * (0.45 + 0.55 * depth)
      pose.color.setHSL(s.hue, 0.85, 0.6)
      pose.sway = s.sway
      jellies[0].draw(pose, dt, t, px)
      leadColor.copy(pose.color)

      // Companions (COUNT above halfway): their own drift, the lead's pulse late.
      echoT += dt
      while (echoT >= ECHO / echo.length) {
        echoT -= ECHO / echo.length
        echo[echoAt++ % echo.length] = s.action
      }
      const n = countOf.jellies(s.count)
      for (let j = 1; j < JELLIES; j++) {
        const body = jellies[j]
        body.visible = j < n
        if (j >= n) continue
        const m = mates[j - 1]
        const cx = 0.5 + 0.34 * Math.sin(t * m.fx * 6.28 + m.ph)
        const cy = 0.45 + 0.24 * Math.sin(t * m.fy * 6.28 + m.ph * 1.7)
        const cd = 0.5 + 0.42 * Math.sin(t * m.fz * 6.28 + m.ph * 0.6)
        place(cx, cy, cd, pose.pos)
        const back = Math.round(m.delay / (ECHO / echo.length))
        pose.action = echo[(echoAt - back + echo.length * 4) % echo.length]
        pose.pitch = Math.cos(t * m.fz * 6.28 + m.ph * 0.6) * 0.35
        pose.tilt = -Math.cos(t * m.fx * 6.28 + m.ph) * 0.3
        pose.yaw = Math.sin(t * 0.13 + m.ph) * 0.4
        pose.R = 0.15 * m.size * (0.55 + 0.9 * s.grow)
        pose.glow = glow * (0.45 + 0.55 * cd) * 0.85
        pose.color.setHSL((s.hue + m.hue + 1) % 1, 0.85, 0.6)
        pose.sway = s.sway * 0.6
        body.draw(pose, dt, t, px)
      }

      // Snow drifts up slowly and wraps; it catches the lead jelly's light nearby.
      // COUNT below halfway thins it out.
      const flakes = Math.min(SNOW, countOf.snow(s.count))
      snow.geometry.setDrawRange(0, flakes)
      const leadGlow = glow * (0.45 + 0.55 * depth)
      for (let i = 0; i < flakes; i++) {
        const q = i * 3
        sp[q] += (Math.sin(t * 0.2 + i) * 0.004 - s.sway * 0.01) * dt
        sp[q + 1] += 0.012 * dt
        if (sp[q + 1] > VIEW_H) sp[q + 1] = -VIEW_H
        if (sp[q] > VIEW_H * aspect) sp[q] = -VIEW_H * aspect
        if (sp[q] < -VIEW_H * aspect) sp[q] = VIEW_H * aspect
        const d = Math.hypot(sp[q] - lead.x, sp[q + 1] - lead.y, sp[q + 2] - lead.z)
        const lit = 0.22 + leadGlow * 0.7 * Math.exp(-d * d * 6)
        st[q] = 0.55 * lit + leadColor.r * lit * 0.4
        st[q + 1] = 0.65 * lit + leadColor.g * lit * 0.4
        st[q + 2] = 0.75 * lit + leadColor.b * lit * 0.4
      }
      snow.geometry.attributes.position.needsUpdate = true
      snow.geometry.attributes.tint.needsUpdate = true
      snow.material.uniforms.uPx.value = px
    },
    dispose() {
      disposeScene(scene)
    },
  }
}
