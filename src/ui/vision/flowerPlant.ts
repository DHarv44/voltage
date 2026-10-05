import * as THREE from 'three'
import { FLOWER_STAGES } from '../../modules/specs/vision'
import { smooth } from './common'

const SEGS = 14
const PETALS = 8
const LEAF_AT = [3, 5, 7, 9]
const HEALTHY = new THREE.Color(0.24, 0.55, 0.2)
const DRY = new THREE.Color(0.42, 0.32, 0.14)
const BROWN = new THREE.Color(0.36, 0.2, 0.09)

export interface PlantState {
  x: number
  g: number
  open: number
  wilt: number
  fade: number
}

/** One flower: a chain of stem joints (so wind and wilting bend it like a real
 *  stem), four leaves, a head of petals. Its own colour and size. */
export class Plant {
  readonly root = new THREE.Group()
  private readonly joints: THREE.Group[] = []
  private readonly segs: THREE.Mesh[] = []
  private readonly leaves: { pivot: THREE.Group; leaf: THREE.Mesh; side: number; stage: number }[]
  private readonly head = new THREE.Group()
  private readonly petals: { petal: THREE.Mesh; jitter: number }[]
  private readonly centre: THREE.Mesh
  private readonly stemMat: THREE.MeshStandardMaterial
  private readonly leafMat: THREE.MeshStandardMaterial
  private readonly petalMat: THREE.MeshStandardMaterial
  private readonly centreMat: THREE.MeshStandardMaterial
  private readonly color = new THREE.Color()
  private readonly curve: number[]
  readonly headPos = new THREE.Vector3()

  constructor(
    rnd: () => number,
    geo: { seg: THREE.BufferGeometry; leaf: THREE.BufferGeometry; petal: THREE.BufferGeometry; ball: THREE.BufferGeometry },
    private readonly hueShift: number,
    private readonly size: number,
    private readonly lean: number,
  ) {
    this.stemMat = new THREE.MeshStandardMaterial({ color: HEALTHY.clone(), roughness: 0.7 })
    this.leafMat = new THREE.MeshStandardMaterial({ color: HEALTHY.clone(), roughness: 0.6, side: THREE.DoubleSide })
    this.petalMat = new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide, transparent: true })
    this.centreMat = new THREE.MeshStandardMaterial({ color: 0xffc23a, emissive: 0xffa31a, roughness: 0.8 })
    let parent: THREE.Object3D = this.root
    for (let k = 0; k < SEGS; k++) {
      const j = new THREE.Group()
      const m = new THREE.Mesh(geo.seg, this.stemMat)
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
      pivot.add(leaf)
      this.joints[at].add(pivot)
      const side = i % 2 === 0 ? 1 : -1
      pivot.rotation.y = side * 0.5
      return { pivot, leaf, side, stage: FLOWER_STAGES[i] }
    })
    this.petals = Array.from({ length: PETALS }, (_, i) => {
      const pivot = new THREE.Group()
      pivot.rotation.y = (i / PETALS) * Math.PI * 2 + (rnd() - 0.5) * 0.15
      const petal = new THREE.Mesh(geo.petal, this.petalMat)
      pivot.add(petal)
      this.head.add(pivot)
      return { petal, jitter: (rnd() - 0.5) * 0.2 }
    })
    this.centre = new THREE.Mesh(geo.ball, this.centreMat)
    this.head.add(this.centre)
    this.joints[SEGS - 1].add(this.head)
  }

  update(st: PlantState, baseY: number, width: number, sway: number, glow: number, hue: number, t: number): void {
    const visible = st.fade > 0.01
    this.root.visible = visible
    if (!visible) return
    const { g, wilt, open } = st
    this.root.position.set((st.x - 0.5) * width, baseY, (st.x - 0.5) * -0.3)
    const stem = 1.05 * this.size * smooth(0, 0.8, g) + 0.02
    const seg = stem / SEGS
    for (let k = 0; k < SEGS; k++) {
      const f = k / SEGS
      if (k > 0) this.joints[k].position.y = seg
      const r = (0.013 - 0.006 * f) * (0.35 + 0.65 * smooth(0, 0.8, g)) * this.size
      this.segs[k].scale.set(r, seg, r)
      // the stem bends most near the top, and folds over as it dies
      this.joints[k].rotation.z = this.curve[k] - sway * 0.04 * f - this.lean * wilt * 0.32 * f * f
      this.joints[k].rotation.x = Math.sin(t * 0.7 + k * 0.4 + this.hueShift * 9) * 0.004
    }
    this.stemMat.color.copy(HEALTHY).lerp(DRY, wilt)
    this.leafMat.color.copy(HEALTHY).lerp(DRY, wilt * 0.9)
    for (const l of this.leaves) {
      const grown = smooth(l.stage, l.stage + 0.14, g)
      l.leaf.visible = grown > 0.01
      l.leaf.scale.setScalar(0.22 * this.size * grown * (1 - wilt * 0.25))
      const flutter = Math.sin(t * 2.1 + l.stage * 20 + this.hueShift * 7) * 0.04 * (1 + Math.abs(sway))
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
    this.petalMat.opacity = st.fade
    for (const p of this.petals) {
      p.petal.scale.setScalar(0.15 * this.size * (0.35 + 0.65 * bud))
      // petals open, then droop past open and hang as the flower wilts
      p.petal.rotation.x = 0.1 + open * 1.3 + p.jitter * open + wilt * 1.1
    }
    this.centre.scale.setScalar(0.028 * this.size * smooth(0.2, 1, Math.max(open, wilt)) + 0.001)
    this.centreMat.color.setRGB(1, 0.76, 0.23).lerp(BROWN, wilt)
    this.centreMat.emissiveIntensity = (0.2 + glow * 0.8) * (1 - wilt)
    this.head.getWorldPosition(this.headPos)
  }
}
