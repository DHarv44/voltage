import * as THREE from 'three'
import { backdrop, disposeScene, glowPoints, rand, standardCamera, VIEW_H } from './common'
import { makeBell, makeHalo, marginPoint } from './jellyBell'
import { Tentacles } from './jellyTentacles'
import type { SceneFactory } from './types'

const SNOW = 220
const DOTS = 32

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

/** Bioluminescent jellyfish in a dark tank, drifting in marine snow. */
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
    sp[i * 3 + 2] = -1.2 + rnd() * 1.6
  }
  scene.add(snow)

  const body = new THREE.Group()
  const bell = makeBell()
  bell.renderOrder = 3
  body.add(bell)
  scene.add(body)

  const halo = makeHalo()
  halo.renderOrder = 4
  scene.add(halo)

  const dots = glowPoints(DOTS, 0.02)
  dots.renderOrder = 5
  scene.add(dots)

  const count = 14 + Math.floor(rnd() * 6)
  const tent = new Tentacles(count)
  tent.lines.renderOrder = 1
  tent.arms.renderOrder = 2
  scene.add(tent.lines, tent.arms)

  const color = new THREE.Color()
  const v = new THREE.Vector3()
  const anchors = new Float32Array((count + 4) * 3)
  const phase = rnd() * 10

  return {
    scene,
    camera,
    update(s, dt, t, px) {
      bg.material.uniforms.uT.value = t
      color.setHSL(s.hue, 0.85, 0.6)
      const glow = Math.min(1.5, s.glow)
      const R = 0.15 * (0.55 + 0.9 * s.grow)

      // Body: the bell's origin is its margin centre.
      body.position.set((s.x - 0.5) * 2 * halfW, (s.y - 0.5) * 2 * halfH, 0)
      body.rotation.z = -s.tilt
      body.rotation.y = Math.sin(t * 0.15 + phase) * 0.4
      body.scale.setScalar(R)
      body.updateMatrixWorld()
      const u = bell.material.uniforms
      u.uC.value = s.action
      u.uT.value = t
      u.uGlow.value = glow
      u.uColor.value.copy(color)

      v.set(0, 0.25, 0)
      body.localToWorld(v)
      halo.position.set(v.x, v.y, -0.05)
      halo.scale.setScalar(R * 9)
      halo.material.uniforms.uGlow.value = glow
      halo.material.uniforms.uColor.value.copy(color)

      // Margin: lights around the rim, tentacle roots between them.
      const dp = dots.geometry.attributes.position.array as Float32Array
      const dc = dots.geometry.attributes.tint.array as Float32Array
      for (let i = 0; i < DOTS; i++) {
        marginPoint((i / DOTS) * Math.PI * 2, s.action, v)
        body.localToWorld(v)
        dp.set([v.x, v.y, v.z], i * 3)
        const twinkle = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7)
        const b = glow * (0.4 + 0.6 * twinkle)
        dc.set([color.r * b + 0.2 * b, color.g * b + 0.2 * b, color.b * b + 0.2 * b], i * 3)
      }
      dots.geometry.attributes.position.needsUpdate = true
      dots.geometry.attributes.tint.needsUpdate = true
      dots.material.uniforms.uPx.value = px
      dots.material.uniforms.uSize.value = 0.02 * (0.6 + s.grow)

      for (let i = 0; i < count; i++) {
        marginPoint(((i + 0.5) / count) * Math.PI * 2, s.action, v)
        v.multiplyScalar(0.97)
        body.localToWorld(v)
        anchors.set([v.x, v.y, v.z], i * 3)
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4
        v.set(Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14)
        body.localToWorld(v)
        anchors.set([v.x, v.y, v.z], (count + i) * 3)
      }
      tent.update(anchors, R * 5.5, Math.min(dt, 1 / 30), -s.sway * 0.25, color, glow, t)

      // Snow drifts up slowly and wraps; it catches the jelly's light nearby.
      for (let i = 0; i < SNOW; i++) {
        const k = i * 3
        sp[k] += (Math.sin(t * 0.2 + i) * 0.004 - s.sway * 0.01) * dt
        sp[k + 1] += 0.012 * dt
        if (sp[k + 1] > VIEW_H) sp[k + 1] = -VIEW_H
        if (sp[k] > VIEW_H * aspect) sp[k] = -VIEW_H * aspect
        if (sp[k] < -VIEW_H * aspect) sp[k] = VIEW_H * aspect
        const d = Math.hypot(sp[k] - body.position.x, sp[k + 1] - body.position.y)
        const lit = 0.22 + glow * 0.7 * Math.exp(-d * d * 6)
        st[k] = 0.55 * lit + color.r * lit * 0.4
        st[k + 1] = 0.65 * lit + color.g * lit * 0.4
        st[k + 2] = 0.75 * lit + color.b * lit * 0.4
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
