import * as THREE from 'three'

/** Soft round points drawn over what's behind them (not added to it), so
 *  white fluff shows against a bright sky as well as a dark one. The tint
 *  is the colour; its brightness is the opacity (black = invisible). */
function softPoints(count: number, size: number): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: size }, uPx: { value: 300 } },
    vertexShader: `
      attribute vec3 tint; uniform float uSize; uniform float uPx; varying vec3 vTint;
      void main(){
        vTint = tint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uPx / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vTint;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float k = max(vTint.r, max(vTint.g, vTint.b));
        float a = exp(-dot(d, d) * 14.0) * k;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0, 1.0, 0.97), a);
      }`,
    transparent: true,
    depthWrite: false,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  return pts
}

/** Seeds in a dandelion clock. */
const CLOCK_POINTS = 70
/** Loose fluff in the air at once (decoration; the engine's seeds are extra). */
const LOOSE = 160

/** A dandelion's seed clock: a soft white ball of seeds on its head, which
 *  fills out as it forms and thins as the wind takes them. Lives in the
 *  head's own space, so it nods with the stem. */
export class ClockPuff {
  readonly points = softPoints(CLOCK_POINTS, 0.02)
  private readonly dir = new Float32Array(CLOCK_POINTS * 3)
  /** Seeds still on, last frame (to know how many just left). */
  left = 1

  constructor(rnd: () => number) {
    // spread over a sphere (golden-angle spiral), each with a little jitter
    for (let i = 0; i < CLOCK_POINTS; i++) {
      const y = 1 - (2 * (i + 0.5)) / CLOCK_POINTS
      const r = Math.sqrt(1 - y * y)
      const a = i * 2.39996 + rnd() * 0.3
      this.dir.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3)
    }
    // shuffle so seeds leave from all over the ball, not top to bottom
    for (let i = CLOCK_POINTS - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      for (let c = 0; c < 3; c++) [this.dir[i * 3 + c], this.dir[j * 3 + c]] = [this.dir[j * 3 + c], this.dir[i * 3 + c]]
    }
    this.points.renderOrder = 4
  }

  /** `puff`: 0..1 forming, 1..2 blown away; `radius` in head space. Returns
   *  how many seeds left since last time (for loose fluff). */
  update(puff: number, radius: number, px: number, bright: number): number {
    const formed = Math.min(1, puff)
    const left = 1 - Math.min(1, Math.max(0, puff - 1))
    const pos = this.points.geometry.attributes.position.array as Float32Array
    const tint = this.points.geometry.attributes.tint.array as Float32Array
    const on = Math.round(left * CLOCK_POINTS)
    const r = radius * (0.3 + 0.7 * formed)
    for (let i = 0; i < CLOCK_POINTS; i++) {
      pos[i * 3] = this.dir[i * 3] * r
      pos[i * 3 + 1] = this.dir[i * 3 + 1] * r + r * 0.9
      pos[i * 3 + 2] = this.dir[i * 3 + 2] * r
      const b = i < on && puff > 0.05 ? formed * 0.55 * bright : 0
      tint[i * 3] = tint[i * 3 + 1] = tint[i * 3 + 2] = b
    }
    this.points.geometry.attributes.position.needsUpdate = true
    this.points.geometry.attributes.tint.needsUpdate = true
    this.points.material.uniforms.uPx.value = px
    this.points.visible = puff > 0.05 && on > 0
    const gone = Math.max(0, Math.round((this.left - left) * CLOCK_POINTS))
    this.left = left
    return gone
  }
}

/** Loose dandelion fluff on the wind: seeds blown off clocks drift up and
 *  away, sinking slowly, and fade; the engine's seeds (the ones that can take
 *  root) are drawn here too, where the engine says they are. */
export class Fluff {
  readonly points = softPoints(LOOSE + 16, 0.024)
  private readonly vel = new Float32Array(LOOSE * 3)
  private readonly life = new Float32Array(LOOSE)
  private next = 0

  constructor(private readonly rnd: () => number) {
    this.points.renderOrder = 4
  }

  /** `n` seeds leave a clock at world position `at`. */
  release(n: number, at: THREE.Vector3): void {
    const pos = this.points.geometry.attributes.position.array as Float32Array
    for (let k = 0; k < n; k++) {
      const i = this.next++ % LOOSE
      pos.set([at.x + (this.rnd() - 0.5) * 0.05, at.y + this.rnd() * 0.05, at.z + (this.rnd() - 0.5) * 0.05], i * 3)
      this.vel.set([(this.rnd() - 0.3) * 0.15, 0.05 + this.rnd() * 0.08, (this.rnd() - 0.5) * 0.08], i * 3)
      this.life[i] = 1
    }
  }

  /** `seeds`: the engine's seeds in world space (y < −50 = none). */
  update(dt: number, t: number, wind: number, px: number, bright: number, seeds: THREE.Vector3[]): void {
    const pos = this.points.geometry.attributes.position.array as Float32Array
    const tint = this.points.geometry.attributes.tint.array as Float32Array
    for (let i = 0; i < LOOSE; i++) {
      const k = i * 3
      if (this.life[i] <= 0) {
        tint[k] = tint[k + 1] = tint[k + 2] = 0
        continue
      }
      this.life[i] -= dt / 9
      this.vel[k] += (wind * 0.25 + 0.03 - this.vel[k]) * dt * 0.8
      this.vel[k + 1] += (-0.03 + Math.sin(t * 1.3 + i) * 0.04 - this.vel[k + 1]) * dt
      pos[k] += this.vel[k] * dt
      pos[k + 1] += this.vel[k + 1] * dt
      pos[k + 2] += this.vel[k + 2] * dt
      const b = Math.min(1, this.life[i] * 3) * 0.5 * bright
      tint[k] = tint[k + 1] = tint[k + 2] = b
    }
    seeds.forEach((s, j) => {
      const k = (LOOSE + j) * 3
      pos[k] = s.x
      pos[k + 1] = s.y
      pos[k + 2] = s.z
      tint[k] = tint[k + 1] = tint[k + 2] = s.y > -50 ? 0.75 * bright : 0
    })
    this.points.geometry.attributes.position.needsUpdate = true
    this.points.geometry.attributes.tint.needsUpdate = true
    this.points.material.uniforms.uPx.value = px
  }
}
