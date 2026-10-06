import * as THREE from 'three'
import { rand, smooth } from '../common'

/** Branching depth; leaves on each tip (a twig, or a shoot that hasn't
 *  branched yet). */
const DEPTH = 5
const TWIG_LEAVES = 12
const SHOOT_LEAVES = 5
export const MAX_BRANCHES = 400
export const MAX_LEAVES = 2600

/** The trunk grows over this much of the tree's life (g); each generation of
 *  branches buds when its parent is partway along and grows a bit quicker. */
const TRUNK_SPAN = 0.35
const SPAN_DECAY = 0.7
const BUD_DELAY = 0.5

const GREEN = [new THREE.Color(0.2, 0.42, 0.16), new THREE.Color(0.28, 0.5, 0.18), new THREE.Color(0.16, 0.36, 0.14)]
const AUTUMN = [new THREE.Color(0.85, 0.62, 0.12), new THREE.Color(0.86, 0.36, 0.08), new THREE.Color(0.66, 0.16, 0.07), new THREE.Color(0.55, 0.36, 0.12)]

export interface Branch {
  parent: number
  /** Where along its parent it buds (fraction of the parent's length). */
  at: number
  dir: THREE.Vector3
  q: THREE.Quaternion
  len: number
  rad: number
  depth: number
  /** When it buds and how long it takes to grow out (in g). */
  born: number
  span: number
  /** Now: how far grown (0..1), where it starts and ends, and whether it's a tip. */
  f: number
  start: THREE.Vector3
  end: THREE.Vector3
  tip: boolean
}

export interface Leaf {
  branch: number
  /** Around its tip, in full-grown units. */
  offset: THREE.Vector3
  q: THREE.Quaternion
  size: number
  /** It falls when the leaves still on drop below this; turns when autumn passes `turn`. */
  hold: number
  turn: number
  green: THREE.Color
  gold: THREE.Color
  on: boolean
}

export interface TreeShape {
  branches: Branch[]
  leaves: Leaf[]
  /** Height when fully grown (units). */
  fullH: number
}

const up = new THREE.Vector3(0, 1, 0)

/** A tree's whole life's shape, from a seed made of where it stands: a trunk
 *  that forks and forks again, each branch budding from its parent at its own
 *  time, with leaves on every tip. */
export function growShape(x: number): TreeShape {
  const rnd = rand(Math.floor(x * 1e6) + 7)
  const branches: Branch[] = []
  const leaves: Leaf[] = []
  let fullH = 0
  const addLeaves = (branch: number, n: number, spread: number) => {
    for (let k = 0; k < n && leaves.length < MAX_LEAVES; k++)
      leaves.push({
        branch,
        offset: new THREE.Vector3(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).multiplyScalar(spread),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3)),
        size: 0.08 + rnd() * 0.05,
        hold: rnd(),
        turn: rnd() * 0.7,
        green: GREEN[Math.floor(rnd() * GREEN.length)],
        gold: AUTUMN[Math.floor(rnd() * AUTUMN.length)],
        on: false,
      })
  }
  const grow = (parent: number, at: number, from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number, born: number, span: number) => {
    if (branches.length >= MAX_BRANCHES) return
    const i = branches.length
    branches.push({
      parent, at, dir, q: new THREE.Quaternion().setFromUnitVectors(up, dir), len, rad, depth, born, span,
      f: 0, start: new THREE.Vector3(), end: new THREE.Vector3(), tip: false,
    })
    const end = from.clone().addScaledVector(dir, len)
    fullH = Math.max(fullH, end.y)
    if (depth === DEPTH) {
      addLeaves(i, TWIG_LEAVES, 0.2)
      return
    }
    addLeaves(i, SHOOT_LEAVES, 0.08) // while it's still a bare shoot, it carries a few leaves at its tip
    const kids = depth === 0 ? 3 : rnd() < 0.4 && branches.length < MAX_BRANCHES / 2 ? 3 : 2
    for (let k = 0; k < kids; k++) {
      // fork off at an angle, round the parent, reaching up and out
      const side = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize()
      const d = dir.clone().applyAxisAngle(side.cross(dir).normalize(), 0.35 + rnd() * 0.45)
      d.y += 0.25
      d.normalize()
      const kAt = depth === 0 ? 0.75 + rnd() * 0.25 : 0.65 + rnd() * 0.35
      const kBorn = born + span * kAt * BUD_DELAY + rnd() * 0.03
      grow(i, kAt, from.clone().addScaledVector(dir, len * kAt), d, len * (0.68 + rnd() * 0.12), rad * 0.62, depth + 1, kBorn, span * SPAN_DECAY)
    }
  }
  grow(-1, 0, new THREE.Vector3(), new THREE.Vector3((rnd() - 0.5) * 0.1, 1, 0).normalize(), 0.42, 0.04, 0, 0, TRUNK_SPAN)
  return { branches, leaves, fullH }
}

/** Grow the shape to `g`: each branch's length so far, budding from its
 *  parent's current length (so nothing floats), and which are tips (no
 *  grown-out branch of their own yet). Returns the tree's current height. */
export function poseShape(shape: TreeShape, g: number): number {
  let h = 0.002
  const b = shape.branches
  for (const br of b) {
    br.f = smooth(br.born, br.born + br.span, g)
    br.tip = br.f > 0.02
    if (br.parent < 0) br.start.set(0, 0, 0)
    else {
      const p = b[br.parent]
      br.start.copy(p.start).addScaledVector(p.dir, p.len * p.f * br.at)
    }
    br.end.copy(br.start).addScaledVector(br.dir, br.len * br.f)
    h = Math.max(h, br.end.y)
  }
  // a shoot stops being a tip once a branch of its own has grown out
  for (const br of b) if (br.parent >= 0 && br.f > 0.35) b[br.parent].tip = false
  return h
}
