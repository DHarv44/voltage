import * as THREE from 'three'
import { FLOWER_STAGES } from '../../modules/specs/vision'
import { smooth } from './common'
import { PetalLitter } from './flowerLitter'

const SEGS = 14
const PETALS = 8
const LEAF_AT = [3, 5, 7, 9]
const HEALTHY = new THREE.Color(0.24, 0.55, 0.2)
const DRY = new THREE.Color(0.42, 0.32, 0.14)
const BROWN = new THREE.Color(0.36, 0.2, 0.09)
/** How far a dead stem's base hinges over as it falls (the rest is the stem's
 *  own bend), so the head ends up just resting on the soil. */
const TOPPLE = 1.22

export interface PlantState {
  x: number
  g: number
  open: number
  /** 0..1 wilting, then 1..2 the dead stem falling to the ground. */
  wilt: number
  fade: number
}

type Geo = { seg: THREE.BufferGeometry; leaf: THREE.BufferGeometry; petal: THREE.BufferGeometry; ball: THREE.BufferGeometry }

/** One flower: a chain of stem joints (so wind and wilting bend it like a real
 *  stem), four leaves, a head of petals. Its own colour, size, and the way it
 *  faces, so a bed of them has depth rather than a row of cut-outs. When it
 *  dies it droops, drops petals, topples to the soil and rots away there. */
export class Plant {
  readonly root = new THREE.Group()
  /** Hinge at the base: the stem falls over about it. */
  private readonly tilt = new THREE.Group()
  private readonly joints: THREE.Group[] = []
  private readonly segs: THREE.Mesh[] = []
  private readonly leaves: { pivot: THREE.Group; leaf: THREE.Mesh; side: number; stage: number }[]
  private readonly head = new THREE.Group()
  private readonly petals: { petal: THREE.Mesh; jitter: number; letGo: number }[]
  private readonly centre: THREE.Mesh
  private readonly mats: THREE.MeshStandardMaterial[]
  private readonly stemMat: THREE.MeshStandardMaterial
  private readonly leafMat: THREE.MeshStandardMaterial
  private readonly petalMat: THREE.MeshStandardMaterial
  private readonly centreMat: THREE.MeshStandardMaterial
  private readonly color = new THREE.Color()
  private readonly curve: number[]
  /** Which way it faces (yaw): wind and wilting bend it in its own plane. */
  private readonly facing: number
  readonly litter: PetalLitter
  readonly headPos = new THREE.Vector3()

  constructor(rnd: () => number, geo: Geo, private readonly hueShift: number, private readonly size: number, private readonly lean: number) {
    this.stemMat = new THREE.MeshStandardMaterial({ color: HEALTHY.clone(), roughness: 0.7 })
    this.leafMat = new THREE.MeshStandardMaterial({ color: HEALTHY.clone(), roughness: 0.6, side: THREE.DoubleSide })
    this.petalMat = new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide })
    this.centreMat = new THREE.MeshStandardMaterial({ color: 0xffc23a, emissive: 0xffa31a, roughness: 0.8 })
    this.mats = [this.stemMat, this.leafMat, this.petalMat, this.centreMat]
    this.facing = (rnd() - 0.5) * 2.4 // ±70°: some lean toward you, some away
    this.root.rotation.y = this.facing
    this.root.add(this.tilt)
    let parent: THREE.Object3D = this.tilt
    for (let k = 0; k < SEGS; k++) {
      const j = new THREE.Group()
      const m = new THREE.Mesh(geo.seg, this.stemMat)
      m.castShadow = true
      j.add(m)
      parent.add(j)
      this.joints.push(j)
      this.segs.push(m)
      parent = j
    }
    this.curve = Array.from({ length: SEGS }, () => (rnd() - 0.5) * 0.05)
    this.leaves = LEAF_AT.map((at, i) => {
      const pivot = new THREE.Group()
      const leaf = new THREE.Mesh(geo.leaf, this.leafMat)
      leaf.castShadow = true
      pivot.add(leaf)
      this.joints[at].add(pivot)
      const side = i % 2 === 0 ? 1 : -1
      pivot.rotation.y = side * 0.5 + (rnd() - 0.5) * 0.8 // leaves spiral round the stem
      return { pivot, leaf, side, stage: FLOWER_STAGES[i] }
    })
    this.petals = Array.from({ length: PETALS }, (_, i) => {
      const pivot = new THREE.Group()
      pivot.rotation.y = (i / PETALS) * Math.PI * 2 + (rnd() - 0.5) * 0.15
      const petal = new THREE.Mesh(geo.petal, this.petalMat)
      petal.castShadow = true
      pivot.add(petal)
      this.head.add(pivot)
      // when it lets go: a few while it wilts, more as it falls, some never
      return { petal, jitter: (rnd() - 0.5) * 0.2, letGo: 0.35 + rnd() * 1.85 }
    })
    this.centre = new THREE.Mesh(geo.ball, this.centreMat)
    this.centre.castShadow = true
    this.head.add(this.centre)
    this.joints[SEGS - 1].add(this.head)
    this.litter = new PetalLitter(PETALS, geo.petal, this.petalMat, rnd)
  }

  /** `floor(x, z)`: the soil's height at a point in the bed. */
  update(st: PlantState, floor: (x: number, z: number) => number, width: number, sway: number, glow: number, hue: number, t: number, dt: number): void {
    const visible = st.fade > 0.01
    this.root.visible = visible
    if (!visible) {
      this.litter.clear()
      return
    }
    const { g, open } = st
    const wilt = Math.min(1, st.wilt)
    const fall = smooth(0, 1, st.wilt - 1)
    // a bed, not a row: depth from where it came up, and a dead plant sinks
    // a little into the soil as it rots
    const x = (st.x - 0.5) * width
    const z = depthAt(st.x)
    this.root.position.set(x, floor(x, z) - 0.004 - (1 - st.fade) * 0.02, z)
    // falling: slow to start, then over it goes (gravity)
    this.tilt.rotation.z = -this.lean * TOPPLE * fall * fall

    const stem = 1.05 * this.size * smooth(0, 0.8, g) + 0.02
    const seg = stem / SEGS
    // the wind blows along world x; in the plant's own frame that's split
    // between bending sideways (z) and toward/away from us (x)
    const wx = Math.cos(this.facing)
    const wz = Math.sin(this.facing)
    const bend = this.lean * wilt * 0.32 * (1 - fall * 0.8) // a fallen stem lies out flatter
    const stiff = 1 - fall // a stem on the ground doesn't sway
    for (let k = 0; k < SEGS; k++) {
      const f = k / SEGS
      if (k > 0) this.joints[k].position.y = seg
      const r = (0.013 - 0.006 * f) * (0.35 + 0.65 * smooth(0, 0.8, g)) * this.size * (1 - wilt * 0.2)
      this.segs[k].scale.set(r, seg, r)
      const gust = sway * 0.04 * f * stiff
      this.joints[k].rotation.z = this.curve[k] - gust * wx - bend * f * f
      this.joints[k].rotation.x = gust * wz + Math.sin(t * 0.7 + k * 0.4 + this.hueShift * 9) * 0.004 * stiff
    }
    this.stemMat.color.copy(HEALTHY).lerp(DRY, wilt).lerp(BROWN, fall * 0.6)
    this.leafMat.color.copy(HEALTHY).lerp(DRY, wilt * 0.9).lerp(BROWN, fall * 0.5)
    for (const l of this.leaves) {
      const grown = smooth(l.stage, l.stage + 0.14, g)
      l.leaf.visible = grown > 0.01
      l.leaf.scale.setScalar(0.22 * this.size * grown * (1 - wilt * 0.3))
      const flutter = Math.sin(t * 2.1 + l.stage * 20 + this.hueShift * 7) * 0.04 * (1 + Math.abs(sway)) * stiff
      l.pivot.rotation.z = -l.side * (0.95 + wilt * 1.3 + flutter)
    }
    const bud = smooth(FLOWER_STAGES[4] - 0.03, FLOWER_STAGES[5], g)
    this.head.visible = bud > 0.01
    this.head.position.y = seg
    this.head.rotation.x = 0.35 + open * 0.6 + wilt * 1.1
    this.head.rotation.z = -this.lean * wilt * 0.7
    this.color.setHSL((hue + this.hueShift + 1) % 1, 0.75, 0.6).lerp(BROWN, wilt * 0.85)
    this.petalMat.color.copy(this.color)
    this.petalMat.emissive.copy(this.color).multiplyScalar(Math.min(1.2, glow) * 0.4 * (1 - wilt))
    for (const p of this.petals) {
      p.petal.scale.setScalar(0.15 * this.size * (0.35 + 0.65 * bud))
      // petals open, then droop past open and hang as the flower wilts
      p.petal.rotation.x = 0.1 + open * 1.3 + p.jitter * open + wilt * 1.1
    }
    this.centre.scale.setScalar(0.028 * this.size * smooth(0.2, 1, Math.max(open, wilt)) + 0.001)
    this.centreMat.color.setRGB(1, 0.76, 0.23).lerp(BROWN, wilt)
    this.centreMat.emissiveIntensity = (0.2 + glow * 0.8) * (1 - wilt)
    this.head.getWorldPosition(this.headPos)

    // petals let go one by one as it wilts and falls; a new plant has them all
    this.petals.forEach((p, i) => {
      const gone = bud > 0.9 && st.wilt >= p.letGo
      if (gone && !this.litter.isDown(i)) this.litter.drop(i, p.petal)
      else if (!gone && this.litter.isDown(i)) this.litter.lift(i)
      p.petal.visible = !gone
    })
    this.litter.update(dt, t, floor, sway)

    // rotting away: the whole plant (and its fallen petals) fades into the soil
    for (const m of this.mats) {
      m.transparent = st.fade < 0.999
      m.opacity = st.fade
    }
  }
}

/** Where in the bed's depth a plant at x stands (stable for that spot). */
export function depthAt(x: number): number {
  const h = Math.sin(x * 917.3) * 43758.5453
  return 0.15 + (h - Math.floor(h) - 0.5) * 0.9
}
