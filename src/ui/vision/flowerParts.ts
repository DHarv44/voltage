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

const HASH = 'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }'
const STARS = `
    vec2 sp = vec2(vUv.x * uAspect, vUv.y) * 60.0;
    vec2 g = floor(sp);
    vec2 at = vec2(hash(g + 1.7), hash(g + 5.3)) * 0.6 + 0.2;
    float point = smoothstep(0.09, 0.0, length(fract(sp) - at));
    float star = step(0.93, hash(g)) * point * (0.55 + 0.45 * sin(uT * (1.0 + hash(g + 3.1) * 2.0) + hash(g) * 30.0));`

/** Garden sky at dusk: soft blue overhead, lavender, a warm glow on the
 *  horizon, the first faint stars. */
export const DUSK_SKY = `
  uniform float uT; uniform float uAspect; varying vec2 vUv;
  ${HASH}
  void main(){
    vec3 horizon = vec3(0.98, 0.66, 0.5);
    vec3 mid = vec3(0.56, 0.48, 0.74);
    vec3 top = vec3(0.2, 0.27, 0.52);
    vec3 col = mix(horizon, mid, smoothstep(0.05, 0.45, vUv.y));
    col = mix(col, top, smoothstep(0.45, 1.0, vUv.y));
    ${STARS}
    col += vec3(1.0) * star * smoothstep(0.7, 0.95, vUv.y) * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }`

/** Clear northern night over snowy hills: deep blue, not black, so the
 *  aurora has a sky to hang in. */
export const ARCTIC_SKY = `
  uniform float uT; uniform float uAspect; varying vec2 vUv;
  ${HASH}
  void main(){
    vec3 col = mix(vec3(0.06, 0.1, 0.2), vec3(0.01, 0.03, 0.09), smoothstep(0.0, 1.0, vUv.y));
    ${STARS}
    col += vec3(0.85, 0.9, 1.0) * star * smoothstep(0.2, 0.7, vUv.y) * 0.8;
    // snowy hills
    float hill = 0.16 + 0.05 * sin(vUv.x * 7.0 * uAspect) + 0.03 * sin(vUv.x * 19.0 * uAspect + 1.3);
    if (vUv.y < hill) col = mix(vec3(0.5, 0.58, 0.72), vec3(0.32, 0.38, 0.52), (hill - vUv.y) * 4.0);
    gl_FragColor = vec4(col, 1.0);
  }`

/** Summer meadow at late dusk for the fireflies: dark violet sky, grass. */
export const MEADOW_SKY = `
  uniform float uT; uniform float uAspect; varying vec2 vUv;
  ${HASH}
  void main(){
    vec3 col = mix(vec3(0.24, 0.16, 0.3), vec3(0.06, 0.06, 0.16), smoothstep(0.1, 1.0, vUv.y));
    ${STARS}
    col += vec3(1.0) * star * smoothstep(0.5, 0.9, vUv.y) * 0.5;
    float grass = 0.22 + 0.015 * sin(vUv.x * 90.0) + 0.02 * sin(vUv.x * 13.0);
    if (vUv.y < grass) col = mix(vec3(0.05, 0.12, 0.06), vec3(0.08, 0.18, 0.08), vUv.y / grass);
    gl_FragColor = vec4(col, 1.0);
  }`
