import * as THREE from 'three'
import { treeDepth, treeHeight } from '../../../modules/specs/garden'
import { rand, smooth } from '../common'
import type { LeafFall } from './leaves'

/** Branching depth, and leaves per twig. */
const DEPTH = 5
const LEAVES_PER_TWIG = 14
/** Instances each tree has room for. */
const MAX_BRANCHES = 400
const MAX_LEAVES = 2400
const BARK = new THREE.Color(0.3, 0.22, 0.15)
const GREEN = [new THREE.Color(0.2, 0.42, 0.16), new THREE.Color(0.28, 0.5, 0.18), new THREE.Color(0.16, 0.36, 0.14)]
const AUTUMN = [new THREE.Color(0.85, 0.62, 0.12), new THREE.Color(0.86, 0.36, 0.08), new THREE.Color(0.66, 0.16, 0.07), new THREE.Color(0.55, 0.36, 0.12)]

/** Where a tree at x (0..1) stands across the scene: wider than the flower
 *  bed, so they frame it. */
export const treeX = (x: number, width: number): number => (x - 0.5) * width * 1.5

/** One tree's state from the engine (see TREE in specs/garden). */
export interface TreeState {
  x: number
  g: number
  leaves: number
  autumn: number
  fall: number
  fade: number
}

interface Branch {
  m: THREE.Matrix4
  depth: number
}
interface Leaf {
  /** Where it hangs, in the tree's unit space. */
  m: THREE.Matrix4
  /** It falls when the leaves still on drop below this. */
  hold: number
  /** It turns when autumn passes this. */
  turn: number
  green: THREE.Color
  gold: THREE.Color
  on: boolean
}

const up = new THREE.Vector3(0, 1, 0)
const q = new THREE.Quaternion()
const v = new THREE.Vector3()
const s = new THREE.Vector3()
const tmp = new THREE.Matrix4()
const col = new THREE.Color()
const world = new THREE.Vector3()
const zero = new THREE.Matrix4().makeScale(0, 0, 0)

/** A tree in the background: a trunk that forks and forks again (its own
 *  shape, from where it stands), crowned with clusters of leaves. It grows up
 *  from a sapling (the outer twigs fill in last), sways a little, turns gold
 *  and red in its last autumn, drops its leaves one by one, stands bare, then
 *  comes down and rots away into the grass. */
export class TreeView {
  readonly root = new THREE.Group()
  private readonly hinge = new THREE.Group()
  private readonly wood: THREE.InstancedMesh
  private readonly crown: THREE.InstancedMesh
  private readonly barkMat = new THREE.MeshStandardMaterial({ color: BARK, roughness: 0.95 })
  private readonly leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide })
  private branches: Branch[] = []
  private leaves: Leaf[] = []
  private builtFor = -1
  private shownG = -1
  private shownAutumn = -1
  private readonly lean: number
  /** Unit tree height (its shape is grown at about height 1, then scaled). */
  private unitH = 1

  constructor(
    seg: THREE.BufferGeometry,
    leaf: THREE.BufferGeometry,
    private readonly fallen: LeafFall,
    rnd: () => number,
  ) {
    this.lean = rnd() < 0.5 ? -1 : 1
    this.wood = new THREE.InstancedMesh(seg, this.barkMat, MAX_BRANCHES)
    this.crown = new THREE.InstancedMesh(leaf, this.leafMat, MAX_LEAVES)
    this.wood.castShadow = this.wood.receiveShadow = true
    this.crown.castShadow = true
    this.wood.frustumCulled = this.crown.frustumCulled = false
    this.hinge.add(this.wood, this.crown)
    this.root.add(this.hinge)
  }

  /** A new tree in this slot: its own shape, from a seed made of where it stands. */
  private build(x: number): void {
    this.builtFor = x
    const rnd = rand(Math.floor(x * 1e6) + 7)
    this.branches = []
    this.leaves = []
    this.unitH = 0
    const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
      if (this.branches.length >= MAX_BRANCHES) return
      const m = new THREE.Matrix4().compose(from, q.setFromUnitVectors(up, dir), s.set(rad, len, rad))
      this.branches.push({ m, depth })
      const end = from.clone().addScaledVector(dir, len)
      this.unitH = Math.max(this.unitH, end.y)
      if (depth === DEPTH) {
        for (let k = 0; k < LEAVES_PER_TWIG && this.leaves.length < MAX_LEAVES; k++) {
          const at = end.clone().add(v.set(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).multiplyScalar(0.2))
          const lq = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3))
          this.leaves.push({
            m: new THREE.Matrix4().compose(at, lq, s.setScalar(0.08 + rnd() * 0.05)),
            hold: rnd(),
            turn: rnd() * 0.7,
            green: GREEN[Math.floor(rnd() * GREEN.length)],
            gold: AUTUMN[Math.floor(rnd() * AUTUMN.length)],
            on: true,
          })
        }
        return
      }
      const kids = depth === 0 ? 3 : rnd() < 0.4 && this.branches.length < MAX_BRANCHES / 2 ? 3 : 2
      for (let k = 0; k < kids; k++) {
        // fork off at an angle, round the parent, reaching up and out
        const side = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize()
        const d = dir.clone().applyAxisAngle(side.cross(dir).normalize(), 0.35 + rnd() * 0.45)
        d.y += 0.25
        d.normalize()
        const at = depth === 0 ? 0.75 + rnd() * 0.25 : 0.65 + rnd() * 0.35
        grow(from.clone().addScaledVector(dir, len * at), d, len * (0.68 + rnd() * 0.12), rad * 0.62, depth + 1)
      }
    }
    grow(new THREE.Vector3(), new THREE.Vector3((rnd() - 0.5) * 0.1, 1, 0).normalize(), 0.42, 0.04, 0)
    this.shownG = -1
    this.shownAutumn = -1
  }

  update(st: TreeState, floor: number, width: number, sway: number, t: number): void {
    const visible = st.fade > 0.01
    this.root.visible = visible
    if (!visible) {
      this.builtFor = -1
      return
    }
    if (st.x !== this.builtFor) this.build(st.x)
    const h = treeHeight(st.x, st.g)
    this.root.position.set(treeX(st.x, width), floor - (1 - st.fade) * 0.1, treeDepth(st.x))
    this.root.scale.setScalar(h / this.unitH)
    // a slow sway in the wind; then over it goes (slowly at first)
    this.hinge.rotation.z = -this.lean * 1.45 * st.fall * st.fall - sway * 0.012 * (1 - st.fall) + Math.sin(t * 0.4) * 0.004
    // the outer twigs fill in as it grows (only redrawn as it changes)
    const grew = Math.abs(st.g - this.shownG) > 0.003
    if (grew) {
      this.shownG = st.g
      // a sapling is the same tree in miniature (its height is treeHeight's),
      // but spindly: the wood thickens as it grows
      const girth = 0.3 + 0.7 * smooth(0, 0.7, st.g)
      const thicken = new THREE.Matrix4().makeScale(girth, 1, girth)
      this.branches.forEach((b, i) => this.wood.setMatrixAt(i, tmp.copy(b.m).multiply(thicken)))
      this.wood.count = this.branches.length
      this.wood.instanceMatrix.needsUpdate = true
    }
    // leaves: turn colour (each in its own time), then drop one by one
    let changed = false
    // leaves are out from the first weeks; a young tree's are a touch larger
    // for its size (a sapling is mostly leaf)
    const twigs = smooth(0.005, 0.04, st.g) * (1 + 0.6 * (1 - smooth(0, 0.5, st.g)))
    this.leaves.forEach((l) => {
      const on = st.leaves > l.hold && twigs > 0.01
      if (l.on && !on && st.leaves < 0.999 && st.fall === 0) {
        // this one lets go: hand it to the wind
        world.setFromMatrixPosition(tmp.multiplyMatrices(this.crown.matrixWorld, l.m))
        this.fallen.spawn(world, col.copy(l.green).lerp(l.gold, smooth(l.turn, l.turn + 0.3, st.autumn)), 0.06 * (h / this.unitH))
      }
      if (on !== l.on) changed = true
      l.on = on
    })
    if (changed || grew || Math.abs(st.autumn - this.shownAutumn) > 0.01) {
      this.shownAutumn = st.autumn
      this.leaves.forEach((l, i) => {
        this.crown.setMatrixAt(i, l.on ? tmp.copy(l.m).multiply(new THREE.Matrix4().makeScale(twigs, twigs, twigs)) : zero)
        this.crown.setColorAt(i, col.copy(l.green).lerp(l.gold, smooth(l.turn, l.turn + 0.3, st.autumn)))
      })
      this.crown.count = this.leaves.length
      this.crown.instanceMatrix.needsUpdate = true
      if (this.crown.instanceColor) this.crown.instanceColor.needsUpdate = true
    }
    for (const m of [this.barkMat, this.leafMat]) {
      m.transparent = st.fade < 0.999
      m.opacity = st.fade
    }
    this.root.updateMatrixWorld()
  }
}
