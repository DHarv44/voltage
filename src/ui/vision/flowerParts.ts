import * as THREE from 'three'

/** Flat leaf blade from base (0,0) to tip (0,1), cupped along its midrib. */
export function leafGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.28, 0.2, 0.26, 0.7, 0, 1)
  s.bezierCurveTo(-0.26, 0.7, -0.28, 0.2, 0, 0)
  const g = new THREE.ShapeGeometry(s, 12)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    p.setZ(i, x * x * 1.6 - y * y * 0.25)
  }
  g.computeVertexNormals()
  return g
}

/** Petal from base (0,0) to tip (0,1), spoon-shaped and curling outward. */
export function petalGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.22, 0.12, 0.42, 0.62, 0.12, 0.98)
  s.quadraticCurveTo(0, 1.06, -0.12, 0.98)
  s.bezierCurveTo(-0.42, 0.62, -0.22, 0.12, 0, 0)
  const g = new THREE.ShapeGeometry(s, 14)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    p.setZ(i, x * x * 0.9 - y * y * 0.35)
  }
  g.computeVertexNormals()
  return g
}

/** Night garden sky with twinkling stars. */
export const NIGHT_SKY = `
  uniform float uT; uniform float uAspect; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec3 top = vec3(0.03, 0.02, 0.09);
    vec3 dusk = vec3(0.16, 0.08, 0.2);
    vec3 col = mix(dusk, top, smoothstep(0.1, 0.9, vUv.y));
    vec2 sp = vec2(vUv.x * uAspect, vUv.y) * 60.0;
    vec2 g = floor(sp);
    vec2 at = vec2(hash(g + 1.7), hash(g + 5.3)) * 0.6 + 0.2;
    float point = smoothstep(0.09, 0.0, length(fract(sp) - at));
    float star = step(0.93, hash(g)) * point * (0.55 + 0.45 * sin(uT * (1.0 + hash(g + 3.1) * 2.0) + hash(g) * 30.0));
    col += vec3(0.8, 0.85, 1.0) * star * smoothstep(0.35, 0.8, vUv.y) * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }`

/** Dark soil mound the stem grows out of. */
export function soil(width: number): THREE.Mesh {
  const g = new THREE.CircleGeometry(1, 48, 0, Math.PI)
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 1 }))
  m.scale.set(width, 0.16, 1)
  return m
}
