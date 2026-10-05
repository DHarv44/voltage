import * as THREE from 'three'

/** Terminal speed of a falling petal (scene units/s): light and draggy. */
const SINK = 0.11
/** How high above the soil a fallen petal lies. */
const REST = 0.004

interface Fallen {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  spin: THREE.Vector3
  phase: number
  landed: boolean
  /** The yaw it settles at when it lands flat. */
  rest: THREE.Quaternion
}

const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
const turn = new THREE.Quaternion()
const axis = new THREE.Vector3()
const yaw = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)

/** Petals that have come off one plant: they flutter down through the air,
 *  drift with the wind, tumble, and lie flat on the soil until the plant has
 *  rotted away. Lives in world space (the plant's own group moves and falls). */
export class PetalLitter {
  readonly group = new THREE.Group()
  private readonly fallen: Fallen[]

  constructor(count: number, geo: THREE.BufferGeometry, mat: THREE.Material, rnd: () => number) {
    this.fallen = Array.from({ length: count }, () => {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      mesh.castShadow = true
      this.group.add(mesh)
      return {
        mesh,
        vel: new THREE.Vector3(),
        spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
        phase: rnd() * 10,
        landed: false,
        rest: new THREE.Quaternion().multiplyQuaternions(yaw.setFromAxisAngle(UP, rnd() * Math.PI * 2), FLAT),
      }
    })
  }

  /** Petal i lets go, from where the attached one is now. */
  drop(i: number, from: THREE.Object3D): void {
    const f = this.fallen[i]
    from.updateWorldMatrix(true, false)
    from.matrixWorld.decompose(f.mesh.position, f.mesh.quaternion, f.mesh.scale)
    f.vel.set(0, 0, 0)
    f.landed = false
    f.mesh.visible = true
  }

  /** Petal i is back on the flower (a new plant): clear it away. */
  lift(i: number): void {
    this.fallen[i].mesh.visible = false
  }

  isDown(i: number): boolean {
    return this.fallen[i].mesh.visible
  }

  /** `floor(x, z)` is the soil's height there. */
  update(dt: number, t: number, floor: (x: number, z: number) => number, wind: number): void {
    for (const f of this.fallen) {
      if (!f.mesh.visible) continue
      const m = f.mesh
      if (f.landed) {
        // settle flat, with the odd shiver in the wind
        m.quaternion.slerp(f.rest, 1 - Math.exp(-dt / 0.25))
        m.position.x += wind * 0.004 * dt * Math.max(0, Math.sin(t * 1.3 + f.phase))
        continue
      }
      // falling leaf physics, simplified: drag pulls it to a slow sink, it
      // swings side to side (falling-leaf "flutter") and goes where the wind goes
      f.vel.y += (-SINK - f.vel.y) * (1 - Math.exp(-dt / 0.3))
      const swing = Math.sin(t * 3.1 + f.phase)
      f.vel.x += ((swing * 0.09 + wind * 0.12) - f.vel.x) * (1 - Math.exp(-dt / 0.4))
      f.vel.z += (Math.cos(t * 2.3 + f.phase) * 0.05 - f.vel.z) * (1 - Math.exp(-dt / 0.4))
      m.position.addScaledVector(f.vel, dt)
      axis.copy(f.spin)
      turn.setFromAxisAngle(axis, dt * (2.2 + swing))
      m.quaternion.multiply(turn)
      const ground = floor(m.position.x, m.position.z)
      if (m.position.y <= ground + REST) {
        m.position.y = ground + REST
        f.landed = true
      }
    }
  }

  /** Everything gone (the plant has rotted away). */
  clear(): void {
    for (const f of this.fallen) f.mesh.visible = false
  }
}
