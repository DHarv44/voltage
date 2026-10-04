import * as THREE from 'three'

/** Small deterministic PRNG so each tank has its own look but stays stable. */
export function rand(seed: number): () => number {
  let s = seed | 0 || 1
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function standardCamera(aspect: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(35, aspect, 0.1, 20)
  cam.position.set(0, 0, 3)
  return cam
}

/** Half the visible height at z = 0 for standardCamera. */
export const VIEW_H = 3 * Math.tan((17.5 * Math.PI) / 180)

/** Full-view backdrop drawn by a fragment shader (gradients, shafts, stars). */
export function backdrop(aspect: number, fragment: string): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const z = -2
  const h = 2 * (3 - z) * Math.tan((17.5 * Math.PI) / 180) * 1.05
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uAspect: { value: aspect } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: fragment,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), mat)
  mesh.position.z = z
  mesh.renderOrder = -1
  return mesh
}

/** Soft round additive points with a per-point tint (black = invisible). */
export function glowPoints(count: number, size: number): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
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
        float a = exp(-dot(d, d) * 16.0);
        gl_FragColor = vec4(vTint * a, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  return pts
}

export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
}
