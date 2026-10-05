import * as THREE from 'three'

const POOL = 220
/** Seconds a fallen leaf lies in the grass before it's gone. */
const LIE = 30

interface Falling {
  pos: THREE.Vector3
  vel: THREE.Vector3
  rot: THREE.Euler
  spin: THREE.Vector3
  size: number
  age: number
  landed: boolean
  live: boolean
  phase: number
}

const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s = new THREE.Vector3()

/** Leaves let go by the trees: each one sways down in the wind — rocking side
 *  to side as leaves do — tumbles, lands, lies in the grass a while and
 *  withers away. One instanced mesh for the lot. */
export class LeafFall {
  readonly mesh: THREE.InstancedMesh
  private readonly leaves: Falling[]
  private next = 0
  private readonly mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide })

  constructor(geo: THREE.BufferGeometry, private readonly rnd: () => number) {
    this.mesh = new THREE.InstancedMesh(geo, this.mat, POOL)
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
    this.leaves = Array.from({ length: POOL }, () => ({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(),
      spin: new THREE.Vector3(),
      size: 0,
      age: 0,
      landed: false,
      live: false,
      phase: 0,
    }))
    for (let i = 0; i < POOL; i++) {
      this.mesh.setMatrixAt(i, m.makeScale(0, 0, 0))
      this.mesh.setColorAt(i, new THREE.Color())
    }
  }

  spawn(at: THREE.Vector3, color: THREE.Color, size: number): void {
    const i = this.next++ % POOL
    const f = this.leaves[i]
    f.pos.copy(at)
    f.vel.set(0, 0, 0)
    f.rot.set(this.rnd() * 6, this.rnd() * 6, this.rnd() * 6)
    f.spin.set(this.rnd() - 0.5, this.rnd() - 0.5, this.rnd() - 0.5).multiplyScalar(4)
    f.size = size
    f.age = 0
    f.landed = false
    f.live = true
    f.phase = this.rnd() * 10
    this.mesh.setColorAt(i, color)
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  update(dt: number, t: number, floor: number, wind: number): void {
    for (let i = 0; i < POOL; i++) {
      const f = this.leaves[i]
      if (!f.live) continue
      f.age += dt
      let k = f.size
      if (!f.landed) {
        const swing = Math.sin(t * 2.2 + f.phase)
        f.vel.x += (swing * 0.25 + wind * 0.35 - f.vel.x) * Math.min(1, dt * 2)
        f.vel.y += (-0.28 + Math.abs(swing) * 0.12 - f.vel.y) * Math.min(1, dt * 2)
        f.vel.z += (Math.cos(t * 1.7 + f.phase) * 0.1 - f.vel.z) * Math.min(1, dt * 2)
        f.pos.addScaledVector(f.vel, dt)
        f.rot.x += f.spin.x * dt
        f.rot.y += f.spin.y * dt
        f.rot.z += f.spin.z * dt
        if (f.pos.y <= floor + 0.005) {
          f.pos.y = floor + 0.005
          f.landed = true
          f.age = 0
          f.rot.set(-Math.PI / 2 + (this.rnd() - 0.5) * 0.4, f.rot.y, 0)
        }
      } else {
        if (f.age > LIE) f.live = false
        k *= Math.min(1, (LIE - f.age) / 4) // withers into the grass
      }
      this.mesh.setMatrixAt(i, f.live ? m.compose(f.pos, q.setFromEuler(f.rot), s.setScalar(k)) : m.makeScale(0, 0, 0))
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
