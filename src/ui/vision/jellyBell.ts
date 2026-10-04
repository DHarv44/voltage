import * as THREE from 'three'

/** Bell profile (radius, height) in bell units: a dome with a flared margin. */
const PROFILE: [number, number][] = Array.from({ length: 26 }, (_, i) => {
  const t = i / 25
  const a = (t * Math.PI) / 2
  const r = Math.pow(Math.sin(a), 0.85) * (1 + 0.06 * Math.pow(t, 6))
  const y = 0.6 * Math.cos(a) - 0.05 * Math.pow(t, 8)
  return [r, y]
})
const MARGIN = PROFILE[PROFILE.length - 1]
/** How hard each part of the bell squeezes on a stroke (in the shader too). */
const SQUEEZE = 0.32
const STRETCH = 0.18
const DROP = 0.08

/** Where a margin point sits (bell-local) at contraction c. */
export function marginPoint(angle: number, c: number, out: THREE.Vector3): THREE.Vector3 {
  const r = MARGIN[0] * (1 - SQUEEZE * c)
  return out.set(Math.cos(angle) * r, MARGIN[1] * (1 + STRETCH * c) - DROP * c, Math.sin(angle) * r)
}

/** Translucent bell: rim-lit glass with four glowing gonads, deformed on the GPU
 *  by the contraction so the margin squeezes hardest, like a real swim stroke. */
export function makeBell(): THREE.Mesh<THREE.LatheGeometry, THREE.ShaderMaterial> {
  const geo = new THREE.LatheGeometry(
    PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    64,
  )
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uC: { value: 0 },
      uT: { value: 0 },
      uGlow: { value: 0.5 },
      uColor: { value: new THREE.Color() },
    },
    vertexShader: `
      uniform float uC; uniform float uT;
      varying vec3 vN; varying vec3 vView; varying vec3 vObj;
      void main(){
        vec3 p = position;
        float m = 1.0 - clamp(p.y / 0.6, 0.0, 1.0);
        float ang = atan(p.z, p.x);
        float ripple = 1.0 + 0.035 * sin(ang * 8.0 + uT * 1.3) * m * m;
        p.xz *= (1.0 - ${SQUEEZE.toFixed(2)} * uC * m) * ripple;
        p.y = p.y * (1.0 + ${STRETCH.toFixed(2)} * uC) - ${DROP.toFixed(2)} * uC * m;
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uGlow; uniform float uC;
      varying vec3 vN; varying vec3 vView; varying vec3 vObj;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vView)));
        float rim = pow(f, 2.4);
        float a = atan(vObj.z, vObj.x);
        float r = length(vObj.xz);
        float lobe = smoothstep(0.55, 1.0, cos(a * 4.0 + 0.4)) * smoothstep(0.2, 0.05, abs(r - 0.42)) * step(0.12, vObj.y);
        float canals = smoothstep(0.96, 1.0, cos(a * 8.0)) * 0.35;
        vec3 col = uColor * (0.06 + rim * 0.85 + canals * (1.0 - r) + lobe * 0.55) + vec3(0.9, 0.95, 1.0) * rim * rim * 0.25;
        gl_FragColor = vec4(col * (0.35 + uGlow * 0.9), 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  return new THREE.Mesh(geo, mat)
}

/** Additive radial glow behind and around the bell. */
export function makeHalo(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uGlow: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uColor; uniform float uGlow; varying vec2 vUv;
      void main(){
        vec2 d = vUv - 0.5;
        float a = exp(-dot(d, d) * 22.0) * 0.6 + exp(-dot(d, d) * 90.0) * 0.4;
        gl_FragColor = vec4(uColor * a * uGlow * 0.55, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
}
