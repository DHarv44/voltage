import * as THREE from 'three'

/** A hanging chain simulated with Verlet integration and distance constraints:
 *  the anchor is carried by the bell, the rest trails through the water. */
class Chain {
  readonly p: Float32Array
  readonly q: Float32Array
  constructor(readonly n: number) {
    this.p = new Float32Array(n * 3)
    this.q = new Float32Array(n * 3)
  }

  place(ax: number, ay: number, az: number, seg: number): void {
    for (let i = 0; i < this.n; i++) {
      const k = i * 3
      this.p[k] = this.q[k] = ax
      this.p[k + 1] = this.q[k + 1] = ay - i * seg
      this.p[k + 2] = this.q[k + 2] = az
    }
  }

  step(ax: number, ay: number, az: number, seg: number, dt: number, drift: number, gravity: number): void {
    const { p, q, n } = this
    const damp = Math.exp(-dt * 2.4)
    const dt2 = dt * dt
    for (let i = 1; i < n; i++) {
      const k = i * 3
      for (let c = 0; c < 3; c++) {
        const v = (p[k + c] - q[k + c]) * damp
        q[k + c] = p[k + c]
        p[k + c] += v
      }
      p[k] += drift * dt2
      p[k + 1] -= gravity * dt2
    }
    p[0] = ax
    p[1] = ay
    p[2] = az
    for (let it = 0; it < 3; it++)
      for (let i = 1; i < n; i++) {
        const a = (i - 1) * 3
        const b = i * 3
        const dx = p[b] - p[a]
        const dy = p[b + 1] - p[a + 1]
        const dz = p[b + 2] - p[a + 2]
        const d = Math.hypot(dx, dy, dz) || 1e-6
        const s = (d - seg) / d
        // the anchor never moves; otherwise share the correction
        const wa = i === 1 ? 0 : 0.5
        const wb = i === 1 ? 1 : 0.5
        p[a] += dx * s * wa
        p[a + 1] += dy * s * wa
        p[a + 2] += dz * s * wa
        p[b] -= dx * s * wb
        p[b + 1] -= dy * s * wb
        p[b + 2] -= dz * s * wb
      }
  }
}

const TENTACLE_PTS = 26
const ARM_PTS = 16

/** Fine marginal tentacles (glowing threads) and four frilly oral arms (ribbons). */
export class Tentacles {
  readonly lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
  readonly arms: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  private readonly threads: Chain[]
  private readonly armChains: Chain[]
  private placed = false

  constructor(readonly count: number) {
    this.threads = Array.from({ length: count }, () => new Chain(TENTACLE_PTS))
    this.armChains = Array.from({ length: 4 }, () => new Chain(ARM_PTS))

    const segs = count * (TENTACLE_PTS - 1)
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 6), 3))
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(segs * 6), 3))
    this.lines = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    )
    this.lines.frustumCulled = false

    const ag = new THREE.BufferGeometry()
    const verts = 4 * ARM_PTS * 2
    ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
    ag.setAttribute('color', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
    const idx: number[] = []
    for (let a = 0; a < 4; a++)
      for (let i = 0; i < ARM_PTS - 1; i++) {
        const v = (a * ARM_PTS + i) * 2
        idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
      }
    ag.setIndex(idx)
    this.arms = new THREE.Mesh(
      ag,
      new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    )
    this.arms.frustumCulled = false
  }

  /** anchors: tentacle anchors then the four arm anchors, world xyz each. */
  update(anchors: Float32Array, length: number, dt: number, drift: number, color: THREE.Color, glow: number, t: number): void {
    const seg = length / (TENTACLE_PTS - 1)
    const armSeg = (length * 0.45) / (ARM_PTS - 1)
    if (!this.placed) {
      this.threads.forEach((c, i) => c.place(anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2], seg))
      this.armChains.forEach((c, i) => {
        const k = (this.count + i) * 3
        c.place(anchors[k], anchors[k + 1], anchors[k + 2], armSeg)
      })
      this.placed = true
    }
    // each thread catches its own eddies, so they never hang in parallel lines
    this.threads.forEach((c, i) =>
      c.step(anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2], seg, dt, drift + Math.sin(t * 0.8 + i * 2.3) * 0.12, 0.3),
    )
    this.armChains.forEach((c, i) => {
      const k = (this.count + i) * 3
      c.step(anchors[k], anchors[k + 1], anchors[k + 2], armSeg, dt, drift * 0.6, 0.5)
    })

    const pos = this.lines.geometry.attributes.position.array as Float32Array
    const col = this.lines.geometry.attributes.color.array as Float32Array
    let o = 0
    const bright = 0.25 + glow * 0.75
    for (const c of this.threads)
      for (let i = 0; i < c.n - 1; i++)
        for (const j of [i, i + 1]) {
          const fade = Math.pow(1 - j / (c.n - 1), 1.4) * bright
          pos[o] = c.p[j * 3]
          pos[o + 1] = c.p[j * 3 + 1]
          pos[o + 2] = c.p[j * 3 + 2]
          col[o] = color.r * fade
          col[o + 1] = color.g * fade
          col[o + 2] = color.b * fade
          o += 3
        }
    this.lines.geometry.attributes.position.needsUpdate = true
    this.lines.geometry.attributes.color.needsUpdate = true

    const ap = this.arms.geometry.attributes.position.array as Float32Array
    const ac = this.arms.geometry.attributes.color.array as Float32Array
    o = 0
    this.armChains.forEach((c, a) => {
      for (let i = 0; i < c.n; i++) {
        const j = Math.min(c.n - 1, i + 1)
        const h = Math.max(0, i - 1)
        let dx = c.p[j * 3] - c.p[h * 3]
        let dy = c.p[j * 3 + 1] - c.p[h * 3 + 1]
        const d = Math.hypot(dx, dy) || 1
        dx /= d
        dy /= d
        // frills: the ribbon's width ripples down its length
        const w = length * 0.05 * (1 - (i / c.n) * 0.6) * (0.7 + 0.45 * Math.sin(i * 1.9 + t * 1.6 + a * 2))
        const fade = (0.35 + 0.65 * (1 - i / c.n)) * bright * 0.55
        for (const s of [-1, 1]) {
          ap[o] = c.p[i * 3] - dy * w * s
          ap[o + 1] = c.p[i * 3 + 1] + dx * w * s
          ap[o + 2] = c.p[i * 3 + 2]
          ac[o] = color.r * fade
          ac[o + 1] = color.g * fade
          ac[o + 2] = color.b * fade
          o += 3
        }
      }
    })
    this.arms.geometry.attributes.position.needsUpdate = true
    this.arms.geometry.attributes.color.needsUpdate = true
  }
}
