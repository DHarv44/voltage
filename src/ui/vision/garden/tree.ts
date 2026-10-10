import * as THREE from 'three'
import { treeDepth, treeHeight } from '../../../modules/specs/garden'
import { smooth } from '../common'
import type { LeafFall } from './leaves'
import { growShape, MAX_BRANCHES, MAX_LEAVES, poseShape, type TreeShape } from './treeShape'

const BARK = new THREE.Color(0.3, 0.22, 0.15)

/** Where a tree at x (0..1) stands across the scene: the garden's own tree
 *  (slot 0) somewhere behind the middle of the flower bed, the others spread
 *  wide along the edge of the wood. */
export const treeX = (slot: number, x: number, width: number): number => (x - 0.5) * width * (slot === 0 ? 0.6 : 5)

/** One tree's state from the engine (see TREE in specs/garden). */
export interface TreeState {
  x: number
  g: number
  leaves: number
  autumn: number
  fall: number
  fade: number
}

const m = new THREE.Matrix4()
const p = new THREE.Vector3()
const s = new THREE.Vector3()
const col = new THREE.Color()
const world = new THREE.Vector3()
const zero = new THREE.Matrix4().makeScale(0, 0, 0)

/** A tree in the background, growing as trees do: a single whip with a few
 *  leaves at its tip, then buds along it open into shoots that lengthen and
 *  branch in turn, the leaves always out on the newest tips, the wood
 *  thickening year on year. It sways a little, turns gold and red in its last
 *  autumn, drops its leaves one by one, stands bare, then comes down and rots
 *  away into the grass. */
export class TreeView {
  readonly root = new THREE.Group()
  private readonly hinge = new THREE.Group()
  private readonly wood: THREE.InstancedMesh
  private readonly crown: THREE.InstancedMesh
  private readonly barkMat = new THREE.MeshStandardMaterial({ color: BARK, roughness: 0.95 })
  private readonly leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide })
  private shape: TreeShape | null = null
  private builtFor = -1
  private shown = { g: -1, leaves: -1, autumn: -1 }
  /** The current shape's height (units), from the last pose. */
  private posedH = 1
  private readonly lean: number

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
    this.wood.count = this.crown.count = 0
    this.hinge.add(this.wood, this.crown)
    this.root.add(this.hinge)
  }

  /** `slot`: which tree this is (0 is the garden's own; see treeX). */
  update(slot: number, st: TreeState, floor: number, width: number, sway: number, t: number): void {
    const visible = st.fade > 0.01
    this.root.visible = visible
    if (!visible) {
      this.builtFor = -1
      return
    }
    if (st.x !== this.builtFor || !this.shape) {
      // a new tree in this slot: its own shape, from where it stands
      this.shape = growShape(st.x)
      this.builtFor = st.x
      this.shown = { g: -1, leaves: -1, autumn: -1 }
    }
    const shape = this.shape
    const grew = Math.abs(st.g - this.shown.g) > 0.002
    if (grew) {
      this.shown.g = st.g
      this.posedH = poseShape(shape, st.g)
    }
    // The shape grown so far is scaled to the tree's height now; wood and
    // leaves are sized by the full-grown tree's scale instead, so a young
    // tree is a thin whip, not a shrunken old one.
    const full = treeHeight(st.x, st.g)
    const scale = full / this.posedH
    const ratio = this.posedH / shape.fullH // local units per full-grown unit, at this scale
    this.root.position.set(treeX(slot, st.x, width), floor - (1 - st.fade) * 0.1, treeDepth(slot, st.x))
    this.root.scale.setScalar(scale)
    // a slow sway in the wind; then over it goes (slowly at first)
    this.hinge.rotation.z = -this.lean * 1.45 * st.fall * st.fall - sway * 0.012 * (1 - st.fall) + Math.sin(t * 0.4) * 0.004

    if (grew) {
      const girth = 0.5 + 0.5 * smooth(0, 0.8, st.g) // the wood thickens with age
      shape.branches.forEach((b, i) => {
        if (b.f < 0.001) return this.wood.setMatrixAt(i, zero)
        const r = b.rad * girth * (b.depth === 0 ? 1 : 0.4 + 0.6 * b.f) * ratio // new shoots are thin
        this.wood.setMatrixAt(i, m.compose(b.start, b.q, s.set(r, b.len * b.f, r)))
      })
      this.wood.count = shape.branches.length
      this.wood.instanceMatrix.needsUpdate = true
    }

    // Leaves sit on the tips (a shoot hands its leaves on to its own shoots
    // as they grow out); in the last autumn they turn, each in its own time,
    // then let go one by one.
    const autumnChanged = Math.abs(st.autumn - this.shown.autumn) > 0.01
    if (!grew && !autumnChanged && Math.abs(st.leaves - this.shown.leaves) < 0.001) return this.finish(st)
    this.shown.leaves = st.leaves
    this.shown.autumn = st.autumn
    const young = 1 + 0.6 * (1 - smooth(0, 0.5, st.g)) // a young tree is mostly leaf
    shape.leaves.forEach((l, i) => {
      const b = shape.branches[l.branch]
      const out = smooth(0.02, 0.2, b.f)
      const present = b.tip && out > 0.01
      const held = st.leaves > l.hold
      col.copy(l.green).lerp(l.gold, smooth(l.turn, l.turn + 0.3, st.autumn))
      p.copy(b.end).addScaledVector(l.offset, ratio)
      if (l.on && present && !held && st.fall === 0) {
        // this one lets go: hand it to the wind
        world.copy(p).applyMatrix4(this.crown.matrixWorld)
        this.fallen.spawn(world, col, l.size * young * (full / shape.fullH))
      }
      l.on = present && held
      this.crown.setMatrixAt(i, l.on ? m.compose(p, l.q, s.setScalar(l.size * ratio * young * out)) : zero)
      this.crown.setColorAt(i, col)
    })
    this.crown.count = shape.leaves.length
    this.crown.instanceMatrix.needsUpdate = true
    if (this.crown.instanceColor) this.crown.instanceColor.needsUpdate = true
    this.finish(st)
  }

  private finish(st: TreeState): void {
    for (const mat of [this.barkMat, this.leafMat]) {
      mat.transparent = st.fade < 0.999
      mat.opacity = st.fade
    }
    this.root.updateMatrixWorld()
  }
}
