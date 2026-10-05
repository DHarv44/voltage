import * as THREE from 'three'
import { FLOWER_STAGES, plantDepth, plantHeight } from '../../../modules/specs/garden'
import { smooth } from '../common'
import { ClockPuff } from './fluff'
import { PetalLitter } from './litter'
import { LOOKS, type Look } from './species'

const SEGS = 14
/** Petals built per plant (the most any species has). */
const MAX_PETALS = 28
const HEALTHY = new THREE.Color(0.24, 0.55, 0.2)
const DRY = new THREE.Color(0.42, 0.32, 0.14)
const BROWN = new THREE.Color(0.36, 0.2, 0.09)
/** How far a dead stem's base hinges over as it falls (the rest is the stem's
 *  own bend), so the head ends up just resting on the ground. */
const TOPPLE = 1.22

/** One plant's state from the engine (see PLANT in specs/garden). */
export interface PlantState {
  x: number
  g: number
  open: number
  /** 0..1 wilting, then 1..2 the dead stem falling to the ground. */
  wilt: number
  fade: number
  species: number
  puff: number
  size: number
}

export type Geo = { seg: THREE.BufferGeometry; leaf: THREE.BufferGeometry; petal: THREE.BufferGeometry; ball: THREE.BufferGeometry }

/** What the plant needs from its scene each frame. */
export interface PlantWorld {
  floor: number
  width: number
  sway: number
  glow: number
  hue: number
  /** Which way the sun is (yaw), for sunflowers. */
  sunYaw: number
  /** Daylight 0..1 (fluff shows less at night). */
  light: number
  t: number
  dt: number
  px: number
}

/** One flower: a chain of stem joints (so wind and wilting bend it like a real
 *  stem), four leaves, a head of petals, shaped by its species. It faces its
 *  own way, so a bed of them has depth rather than a row of cut-outs. When it
 *  dies it droops, drops petals, topples into the grass and rots away there. */
export class Plant {
  readonly root = new THREE.Group()
  /** Hinge at the base: the stem falls over about it. */
  private readonly tilt = new THREE.Group()
  private readonly joints: THREE.Group[] = []
  private readonly segs: THREE.Mesh[] = []
  private readonly leaves: { pivot: THREE.Group; leaf: THREE.Mesh; side: number; stage: number }[]
  private readonly head = new THREE.Group()
  private readonly petals: { pivot: THREE.Group; petal: THREE.Mesh; jitter: number; letGo: number }[]
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
  private readonly lean: number
  private readonly hueShift: number
  private species = -1
  private look: Look = LOOKS[0]
  readonly litter: PetalLitter
  readonly puff: ClockPuff
  readonly headPos = new THREE.Vector3()
  /** Loose seeds that just left its clock (the scene blows them away). */
  released = 0

  constructor(rnd: () => number, geo: Geo) {
    this.hueShift = rnd() * 0.17 - 0.35
    this.lean = rnd() < 0.5 ? -1 : 1
    this.stemMat = new THREE.MeshStandardMaterial({ color: HEALTHY.clone(), roughness: 0.7 })
    this.leafMat = new THREE.MeshStandardMaterial({ color: HEALTHY.clone(), roughness: 0.6, side: THREE.DoubleSide })
    this.petalMat = new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide })
    this.centreMat = new THREE.MeshStandardMaterial({ roughness: 0.8 })
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
    this.leaves = FLOWER_STAGES.slice(0, 4).map((stage, i) => {
      const pivot = new THREE.Group()
      const leaf = new THREE.Mesh(geo.leaf, this.leafMat)
      leaf.castShadow = true
      pivot.add(leaf)
      const side = i % 2 === 0 ? 1 : -1
      pivot.rotation.y = side * 0.5 + (rnd() - 0.5) * 0.8 // leaves spiral round the stem
      return { pivot, leaf, side, stage }
    })
    this.petals = Array.from({ length: MAX_PETALS }, () => {
      const pivot = new THREE.Group()
      const petal = new THREE.Mesh(geo.petal, this.petalMat)
      petal.castShadow = true
      pivot.add(petal)
      this.head.add(pivot)
      // when it lets go: a few while it wilts, more as it falls, some never
      return { pivot, petal, jitter: (rnd() - 0.5) * 0.2, letGo: 0.35 + rnd() * 1.85 }
    })
    this.centre = new THREE.Mesh(geo.ball, this.centreMat)
    this.centre.castShadow = true
    this.head.add(this.centre)
    this.puff = new ClockPuff(rnd)
    this.head.add(this.puff.points)
    this.joints[SEGS - 1].add(this.head)
    this.litter = new PetalLitter(MAX_PETALS, geo.petal, this.petalMat, rnd)
  }

  /** A new plant in this slot may be another species: reshape. */
  private become(species: number): void {
    this.species = species
    this.look = LOOKS[species] ?? LOOKS[0]
    const L = this.look
    this.leaves.forEach((l, i) => this.joints[L.leafAt[i]].add(l.pivot))
    this.petals.forEach((p, i) => {
      p.pivot.visible = i < L.petals
      p.pivot.rotation.y = (i / L.petals) * Math.PI * 2 + p.jitter * 0.6
    })
    this.centreMat.color.set(L.centreColor)
    this.centreMat.emissive.set(L.centreGlow ? 0xffa31a : 0x000000)
    this.head.rotation.order = L.tracksSun ? 'YXZ' : 'XYZ'
    this.litter.clear()
  }

  update(st: PlantState, w: PlantWorld): void {
    const visible = st.fade > 0.01
    this.root.visible = visible
    if (!visible) {
      this.litter.clear()
      this.released = 0
      return
    }
    if (Math.round(st.species) !== this.species) this.become(Math.round(st.species))
    const L = this.look
    const { g, open } = st
    const size = st.size || 1
    const wilt = Math.min(1, st.wilt)
    const fall = smooth(0, 1, st.wilt - 1)
    const x = (st.x - 0.5) * w.width
    // a dead plant sinks a little into the grass as it rots
    this.root.position.set(x, w.floor - 0.004 - (1 - st.fade) * 0.02, plantDepth(st.x))
    this.tilt.rotation.z = -this.lean * TOPPLE * fall * fall // slow to start, then over it goes

    const seg = plantHeight(size, this.species, g) / SEGS
    // the wind blows along world x; in the plant's own frame that's split
    // between bending sideways (z) and toward/away from us (x)
    const wx = Math.cos(this.facing)
    const wz = Math.sin(this.facing)
    const bend = this.lean * wilt * 0.32 * (1 - fall * 0.8) // a fallen stem lies out flatter
    const stiff = 1 - fall // a stem on the ground doesn't sway
    for (let k = 0; k < SEGS; k++) {
      const f = k / SEGS
      if (k > 0) this.joints[k].position.y = seg
      const r = (0.013 - 0.006 * f) * (0.35 + 0.65 * smooth(0, 0.8, g)) * size * L.stem * (1 - wilt * 0.2)
      this.segs[k].scale.set(r, seg, r)
      const gust = w.sway * 0.04 * f * stiff
      this.joints[k].rotation.z = this.curve[k] - gust * wx - bend * f * f
      this.joints[k].rotation.x = gust * wz + Math.sin(w.t * 0.7 + k * 0.4 + this.hueShift * 9) * 0.004 * stiff
    }
    this.stemMat.color.copy(HEALTHY).lerp(DRY, wilt).lerp(BROWN, fall * 0.6)
    this.leafMat.color.copy(HEALTHY).lerp(DRY, wilt * 0.9).lerp(BROWN, fall * 0.5)
    for (const l of this.leaves) {
      const grown = smooth(l.stage, l.stage + 0.14, g)
      l.leaf.visible = grown > 0.01
      const ls = 0.22 * size * L.leaf * grown * (1 - wilt * 0.3)
      l.leaf.scale.set(ls / Math.sqrt(L.leafLong), ls * L.leafLong, ls)
      const flutter = Math.sin(w.t * 2.1 + l.stage * 20 + this.hueShift * 7) * 0.04 * (1 + Math.abs(w.sway)) * stiff
      l.pivot.rotation.z = -l.side * (0.95 + wilt * 1.3 + flutter)
    }

    const bud = smooth(FLOWER_STAGES[4] - 0.03, FLOWER_STAGES[5], g)
    this.head.visible = bud > 0.01
    this.head.position.y = seg
    if (L.tracksSun) {
      // turn to the sun (or wait facing east at night), nodding as it dies
      this.head.rotation.y = w.sunYaw - this.facing
      this.head.rotation.x = 1.05 + wilt * 0.7
      this.head.rotation.z = 0
    } else {
      this.head.rotation.x = 0.35 + open * 0.6 + wilt * 1.1
      this.head.rotation.z = -this.lean * wilt * 0.7
    }
    L.color(w.hue, this.hueShift, this.color).lerp(BROWN, wilt * 0.85)
    this.petalMat.color.copy(this.color)
    this.petalMat.emissive.copy(this.color).multiplyScalar(Math.min(1.2, w.glow) * 0.4 * (1 - wilt))
    // a dandelion's yellow head closes and shrinks away as the clock forms
    const petalsLeft = 1 - Math.min(1, st.puff * 1.5)
    const ps = size * (0.35 + 0.65 * bud) * petalsLeft
    for (let i = 0; i < L.petals; i++) {
      const p = this.petals[i]
      p.petal.scale.set(L.petalW * ps, L.petalL * ps, L.petalW * ps)
      // petals open, then droop past open and hang as the flower wilts
      p.petal.rotation.x = L.cup + open * L.spread + p.jitter * open + wilt * L.droop
    }
    const cs = L.centre * size * smooth(0.2, 1, Math.max(open, wilt, L.tracksSun ? bud : 0)) + 0.001
    this.centre.scale.set(cs, cs * L.centreFlat, cs)
    this.centreMat.color.set(L.centreColor).lerp(BROWN, wilt)
    this.centreMat.emissiveIntensity = L.centreGlow * (0.2 + w.glow * 0.8) * (1 - wilt)
    this.head.getWorldPosition(this.headPos)
    this.released = this.puff.update(st.puff, 0.06 * size, w.px, 0.5 + 0.5 * w.light)

    // petals let go one by one as it wilts and falls; a new plant has them all
    for (let i = 0; i < MAX_PETALS; i++) {
      const p = this.petals[i]
      const gone = L.sheds && i < L.petals && bud > 0.9 && st.wilt >= p.letGo
      if (gone && !this.litter.isDown(i)) this.litter.drop(i, p.petal)
      else if (!gone && this.litter.isDown(i)) this.litter.lift(i)
      p.petal.visible = !gone && i < L.petals
    }
    this.litter.update(w.dt, w.t, () => w.floor, w.sway)

    // rotting away: the whole plant (and its fallen petals) fades into the grass
    for (const m of this.mats) {
      m.transparent = st.fade < 0.999
      m.opacity = st.fade
    }
  }
}
