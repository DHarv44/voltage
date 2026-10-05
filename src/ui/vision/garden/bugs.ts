import * as THREE from 'three'
import { BEES, BUG, BUG_VALUES, GARDEN_BUGS } from '../../../modules/specs/garden'

const BUTTERFLY_COLORS = [0xe8761c, 0x3d7fe0, 0xf0de78]

/** A bee: striped abdomen, fuzzy thorax, dark head, two glassy wings. Faces +z. */
function bee(): { obj: THREE.Group; wings: THREE.Object3D[] } {
  const obj = new THREE.Group()
  const ball = new THREE.SphereGeometry(1, 12, 10)
  // stripes painted into the abdomen's vertex colours, along its length
  const abd = ball.clone()
  const p = abd.attributes.position
  const c = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const band = Math.sin(p.getZ(i) * 9) > 0.1
    c.set(band ? [0.08, 0.06, 0.03] : [0.95, 0.72, 0.12], i * 3)
  }
  abd.setAttribute('color', new THREE.BufferAttribute(c, 3))
  const body = new THREE.Mesh(abd, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }))
  body.scale.set(0.011, 0.01, 0.017)
  body.position.z = -0.013
  const thorax = new THREE.Mesh(ball, new THREE.MeshStandardMaterial({ color: 0x8a6420, roughness: 1 }))
  thorax.scale.setScalar(0.009)
  const head = new THREE.Mesh(ball, new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.5 }))
  head.scale.setScalar(0.0065)
  head.position.z = 0.011
  obj.add(body, thorax, head)
  const wingGeo = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2)
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xdfeaff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
  const wings = [-1, 1].map((side) => {
    const hinge = new THREE.Group()
    const w = new THREE.Mesh(wingGeo, wingMat)
    w.scale.set(0.017, 1, 0.008)
    w.position.set(side * 0.017, 0, -0.004)
    hinge.position.y = 0.008
    hinge.add(w)
    hinge.userData.side = side
    obj.add(hinge)
    return hinge
  })
  obj.traverse((o) => (o.castShadow = true))
  return { obj, wings }
}

/** A butterfly: a thin dark body and four broad wings in its colour. Faces +z. */
function butterfly(color: number): { obj: THREE.Group; wings: THREE.Object3D[] } {
  const obj = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.026, 3, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c1712 }))
  obj.add(body)
  const fore = new THREE.Shape()
  fore.moveTo(0, 0)
  fore.bezierCurveTo(0.02, 0.012, 0.045, 0.03, 0.05, 0.022)
  fore.bezierCurveTo(0.046, 0.006, 0.03, -0.004, 0, -0.002)
  const hind = new THREE.Shape()
  hind.moveTo(0, -0.002)
  hind.bezierCurveTo(0.025, -0.004, 0.04, -0.03, 0.026, -0.036)
  hind.bezierCurveTo(0.012, -0.034, 0.004, -0.02, 0, -0.008)
  const geo = [fore, hind].map((s) => new THREE.ShapeGeometry(s, 8).rotateX(-Math.PI / 2))
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide })
  const edge = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.6, side: THREE.DoubleSide })
  const wings = [-1, 1].map((side) => {
    const hinge = new THREE.Group()
    for (const g of geo) {
      const w = new THREE.Mesh(g, mat)
      const rim = new THREE.Mesh(g, edge) // a dark border, peeking out behind
      rim.scale.setScalar(1.08)
      rim.position.y = -0.0005
      w.add(rim)
      w.scale.x = side
      hinge.add(w)
    }
    hinge.userData.side = side
    obj.add(hinge)
    return hinge
  })
  obj.traverse((o) => (o.castShadow = true))
  return { obj, wings }
}

interface BugView {
  obj: THREE.Group
  wings: THREE.Object3D[]
  fly: boolean
  pos: THREE.Vector3
  shown: boolean
  yaw: number
  phase: number
}

const goal = new THREE.Vector3()
const prev = new THREE.Vector3()

/** The insects, drawn where the engine says they are: flying, they wobble
 *  (bees, a blur of wings) or bob (butterflies, slow big wingbeats); settled
 *  on a flower they sit on its head as it sways, a butterfly slowly opening
 *  and closing its wings. */
export class BugsView {
  readonly group = new THREE.Group()
  private readonly bugs: BugView[]

  constructor() {
    this.bugs = Array.from({ length: GARDEN_BUGS }, (_, k) => {
      const fly = k >= BEES
      const { obj, wings } = fly ? butterfly(BUTTERFLY_COLORS[(k - BEES) % BUTTERFLY_COLORS.length]) : bee()
      obj.visible = false
      this.group.add(obj)
      return { obj, wings, fly, pos: new THREE.Vector3(), shown: false, yaw: 0, phase: k * 1.7 }
    })
  }

  /** `heads`: each plant's flower head (world), for insects settled on one. */
  update(led: number[] | undefined, base: number, heads: THREE.Vector3[], width: number, floor: number, t: number, dt: number): void {
    for (let k = 0; k < this.bugs.length; k++) {
      const b = this.bugs[k]
      const o = base + k * BUG_VALUES
      const x = led?.[o + BUG.x] ?? -1
      if (x < -0.5) {
        b.obj.visible = b.shown = false
        continue
      }
      goal.set((x - 0.5) * width, floor + (led?.[o + BUG.y] ?? 0.5), led?.[o + BUG.z] ?? 0)
      const visit = led?.[o + BUG.visit] ?? -1
      // settled on flower k (visit = k + how far settled): sit on its head as it sways
      const land = visit >= 0 ? visit - Math.floor(visit) : 0
      const head = visit >= 0 ? heads[Math.floor(visit)] : undefined
      if (head) {
        prev.copy(head)
        prev.y += 0.018
        goal.lerp(prev, land)
      }
      prev.copy(b.pos)
      if (!b.shown) b.pos.copy(goal)
      else b.pos.lerp(goal, 1 - Math.exp(-dt / 0.06))
      b.shown = true
      b.obj.visible = true
      b.obj.position.copy(b.pos)
      // face the way it's going (turning smoothly); hold still when settled
      const dx = b.pos.x - prev.x
      const dz = b.pos.z - prev.z
      if (land < 0.5 && dx * dx + dz * dz > 1e-8) {
        let dy = Math.atan2(dx, dz) - b.yaw
        dy -= Math.round(dy / (Math.PI * 2)) * Math.PI * 2
        b.yaw += dy * (1 - Math.exp(-dt / 0.12))
      }
      b.obj.rotation.set(0, b.yaw, 0)
      // wings: up-angle from flat
      let a: number
      if (b.fly) a = land > 0.5 ? 1.15 + Math.sin(t * 1.4 + b.phase) * 0.35 : 0.65 + Math.sin(t * 15 + b.phase) * 0.6
      else a = land > 0.5 ? 0.15 : 0.35 + Math.sin(t * 95 + b.phase) * 0.45
      for (const w of b.wings) w.rotation.z = w.userData.side * -a
    }
  }
}
