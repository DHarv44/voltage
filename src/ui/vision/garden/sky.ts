import * as THREE from 'three'
import { sunHeight } from '../../../modules/specs/garden'

type RGB = [number, number, number]
interface Key {
  /** Sun height this look belongs to (−1 midnight … 1 noon). */
  at: number
  top: RGB
  mid: RGB
  /** The horizon (distant things fade into it too). */
  low: RGB
  light: RGB
  lightI: number
  hemiSky: RGB
  hemiGround: RGB
  hemiI: number
  stars: number
}

/** The sky through a day, keyed by the sun's height and blended between. */
const KEYS: Key[] = [
  { at: -0.5, top: [0.015, 0.025, 0.08], mid: [0.03, 0.05, 0.13], low: [0.06, 0.08, 0.17], light: [0.55, 0.65, 0.95], lightI: 0.85, hemiSky: [0.3, 0.35, 0.6], hemiGround: [0.06, 0.06, 0.1], hemiI: 0.75, stars: 1 },
  { at: -0.09, top: [0.2, 0.27, 0.52], mid: [0.56, 0.48, 0.74], low: [0.98, 0.66, 0.5], light: [1, 0.82, 0.63], lightI: 1.9, hemiSky: [0.79, 0.75, 1], hemiGround: [0.23, 0.16, 0.1], hemiI: 1.3, stars: 0.35 },
  { at: 0.05, top: [0.26, 0.33, 0.6], mid: [0.85, 0.55, 0.55], low: [1, 0.62, 0.35], light: [1, 0.65, 0.4], lightI: 2, hemiSky: [0.85, 0.7, 0.8], hemiGround: [0.25, 0.18, 0.1], hemiI: 1.3, stars: 0 },
  { at: 0.3, top: [0.3, 0.48, 0.8], mid: [0.75, 0.72, 0.75], low: [1, 0.8, 0.55], light: [1, 0.85, 0.6], lightI: 2.2, hemiSky: [0.8, 0.85, 1], hemiGround: [0.3, 0.25, 0.15], hemiI: 1.4, stars: 0 },
  { at: 0.8, top: [0.22, 0.45, 0.85], mid: [0.48, 0.68, 0.92], low: [0.78, 0.87, 0.95], light: [1, 0.97, 0.9], lightI: 2.4, hemiSky: [0.75, 0.85, 1], hemiGround: [0.3, 0.32, 0.2], hemiI: 1.5, stars: 0 },
]

const mixRGB = (a: RGB, b: RGB, t: number, out: THREE.Color) => out.setRGB(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)

/** Sky shader: a three-band gradient with stars, a glow on the sun's side
 *  and a moon at night. Colours come from the CPU (blended keys). */
export const GARDEN_SKY = `
  uniform float uT; uniform float uAspect; varying vec2 vUv;
  uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; uniform float uStars;
  uniform vec3 uGlow; uniform float uSunSide; uniform float uMoon;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    float h = vUv.y - 0.5; // 0 at the horizon
    vec3 col = mix(uLow, uMid, smoothstep(-0.05, 0.22, h));
    col = mix(col, uTop, smoothstep(0.22, 0.6, h));
    // brighter toward the sun's side, low down
    col += uGlow * exp(-pow((vUv.x - uSunSide) * 1.6, 2.0)) * exp(-max(h, 0.0) * 5.0);
    vec2 sp = vec2(vUv.x * uAspect, vUv.y) * 60.0;
    vec2 g = floor(sp);
    vec2 at = vec2(hash(g + 1.7), hash(g + 5.3)) * 0.6 + 0.2;
    float star = step(0.93, hash(g)) * smoothstep(0.09, 0.0, length(fract(sp) - at)) * (0.55 + 0.45 * sin(uT * (1.0 + hash(g + 3.1) * 2.0) + hash(g) * 30.0));
    col += vec3(1.0) * star * smoothstep(0.05, 0.3, h) * uStars;
    // the moon, high on the left
    vec2 m = (vUv - vec2(0.24, 0.78)) * vec2(uAspect, 1.0);
    float disc = smoothstep(0.034, 0.03, length(m));
    float crater = 0.85 + 0.15 * hash(floor((m + 0.05) * 90.0));
    col = mix(col, vec3(0.93, 0.92, 0.85) * crater, disc * uMoon);
    col += vec3(0.5, 0.55, 0.7) * exp(-length(m) * 14.0) * 0.25 * uMoon;
    gl_FragColor = vec4(col, 1.0);
  }`

/** The garden's light through the day: the sky's colours, the sun (or the
 *  moon) as a shadow-casting light that crosses the sky, the ambient fill,
 *  and the haze. */
export class GardenSky {
  readonly sun: THREE.DirectionalLight
  private readonly hemi: THREE.HemisphereLight
  /** Which way the sun is (yaw, radians; −π/2 = from the left): sunflowers face it. */
  sunYaw = -Math.PI / 2
  private readonly fogColor = new THREE.Color()

  constructor(
    private readonly scene: THREE.Scene,
    private readonly sky: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>,
    ground: number,
    span: number,
  ) {
    const u = sky.material.uniforms
    for (const k of ['uTop', 'uMid', 'uLow', 'uGlow']) u[k] = { value: new THREE.Color() }
    u.uStars = { value: 0 }
    u.uSunSide = { value: 0 }
    u.uMoon = { value: 0 }
    this.sun = new THREE.DirectionalLight(0xffffff, 2)
    this.sun.target.position.set(0, ground, -0.5)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0008
    this.sun.shadow.normalBias = 0.01
    this.sun.shadow.radius = 3
    const sc = this.sun.shadow.camera
    // big enough for the trees' shadows at any time of day
    sc.left = -span * 1.3
    sc.right = span * 1.3
    sc.top = 7
    sc.bottom = -7
    sc.near = 0.5
    sc.far = 25
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1)
    scene.add(this.sun, this.sun.target, this.hemi)
    scene.fog = new THREE.Fog(0xffffff, 3.2, 9)
  }

  /** `tod`: time of day; `reach`: how far back the camera has pulled (the
   *  haze moves out with it). */
  update(tod: number, ground: number, reach: number): void {
    const s = sunHeight(tod)
    let i = 0
    while (i < KEYS.length - 2 && s > KEYS[i + 1].at) i++
    const a = KEYS[i]
    const b = KEYS[i + 1]
    const t = Math.min(1, Math.max(0, (s - a.at) / (b.at - a.at)))
    const u = this.sky.material.uniforms
    mixRGB(a.top, b.top, t, u.uTop.value)
    mixRGB(a.mid, b.mid, t, u.uMid.value)
    mixRGB(a.low, b.low, t, u.uLow.value)
    u.uStars.value = a.stars + (b.stars - a.stars) * t
    // haze goes to the sky's own colour at the horizon, so the far edge of the
    // lawn melts into it rather than drawing a line
    this.fogColor.copy(u.uLow.value as THREE.Color)
    const fog = this.scene.fog as THREE.Fog
    fog.color.copy(this.fogColor)
    fog.near = 4 + reach
    fog.far = 14 + reach * 1.5
    mixRGB(a.hemiSky, b.hemiSky, t, this.hemi.color)
    mixRGB(a.hemiGround, b.hemiGround, t, this.hemi.groundColor)
    this.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * t
    mixRGB(a.light, b.light, t, this.sun.color)
    this.sun.intensity = a.lightI + (b.lightI - a.lightI) * t

    // The sun rises on the left, crosses high and sets on the right, a little
    // in front of the garden so the flowers are lit; at night the moon takes
    // over from high on the left.
    const arc = (tod - 0.25) * Math.PI * 2 // 0 sunrise, π/2 noon, π sunset
    const night = Math.min(1, Math.max(0, (-s - 0.05) / 0.2))
    const sx = -Math.cos(arc) * 3
    const sy = Math.max(0.6, Math.sin(arc) * 4)
    this.sun.position.set(sx + (-1.8 - sx) * night, ground + sy + (3.5 - sy) * night, 2 + (1.5 - 2) * night)
    this.sunYaw = night > 0.5 ? -Math.PI / 2 : Math.atan2(-Math.cos(arc), 0.35) // sunflowers wait facing east at night
    u.uSunSide.value = 0.5 - Math.cos(arc) * 0.75
    ;(u.uGlow.value as THREE.Color).setRGB(0.35, 0.18, 0.05).multiplyScalar(Math.max(0, 1 - Math.abs(s) * 3) * (1 - night))
    u.uMoon.value = night
  }
}
