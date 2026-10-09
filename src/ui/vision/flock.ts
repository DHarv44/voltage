/** Where the flock as a whole is told to be, each frame (world units). */
export interface FlockGoal {
  x: number
  y: number
  z: number
  /** The flock's radius. */
  spread: number
  /** 0..1: how frightened they are (they fly faster). */
  panic: number
  /** The falcon, if one is diving (`hunting`). */
  fx: number
  fy: number
  fz: number
  hunting: boolean
  /** The reed tops: birds pull up above them (unless they're coming down to roost). */
  floor: number
  roosting: boolean
}

const TABLE = 4096
const CELL = 0.09
const NEAR = 0.09
const TOO_CLOSE = 0.05
/** Neighbours each bird watches (about seven, as real starlings do). */
const WATCH = 8
const SPEED = 0.55
/** How fast a turning wave crosses the flock (units/s) and how wide its front is. */
const WAVE_SPEED = 1.7
const WAVE_BAND = 0.05

const cellOf = (x: number, y: number, z: number): number =>
  ((Math.floor(x / CELL) * 73856093) ^ (Math.floor(y / CELL) * 19349663) ^ (Math.floor(z / CELL) * 83492791)) & (TABLE - 1)

/** Starlings as boids. Each bird only reacts to the few around it (match
 *  their heading, keep near them, not too near) plus a soft pull toward the
 *  flock's goal; a falcon makes the ones nearby bolt, and a turning wave
 *  swerves each bird as its front passes. Fear and turns spread bird to bird,
 *  which is where the murmuration's ripples and shapes come from. */
export class Flock {
  readonly pos: Float32Array
  readonly vel: Float32Array
  /** How broadside each bird is to the camera (0 end-on … 1 side-on). */
  readonly look: Float32Array
  private readonly head = new Int32Array(TABLE)
  private readonly next: Int32Array
  private readonly hitWave: Int32Array
  private wave = 0
  private waveAt = -1
  private waveDir = 1
  private swirl = 1

  constructor(
    readonly max: number,
    rnd: () => number,
  ) {
    this.pos = new Float32Array(max * 3)
    this.vel = new Float32Array(max * 3)
    this.look = new Float32Array(max)
    this.next = new Int32Array(max)
    this.hitWave = new Int32Array(max)
    for (let i = 0; i < max; i++) {
      const a = rnd() * Math.PI * 2
      const r = Math.cbrt(rnd()) * 0.3
      this.pos[i * 3] = Math.cos(a) * r
      this.pos[i * 3 + 1] = (rnd() - 0.5) * 0.3
      this.pos[i * 3 + 2] = Math.sin(a) * r
      this.vel[i * 3] = -Math.sin(a) * SPEED
      this.vel[i * 3 + 2] = Math.cos(a) * SPEED
    }
  }

  /** A turning wave starts from one side (−1 left, +1 right). */
  startWave(dir: number): void {
    this.wave++
    this.waveAt = 0
    this.waveDir = dir
    this.swirl = -this.swirl // and the flock wheels the other way
  }

  /** Fly `n` birds for dt; `cx/cz` = camera position (for how broadside they look). */
  step(dt: number, n: number, g: FlockGoal, cx: number, cz: number): void {
    const { pos, vel, head, next } = this
    head.fill(-1)
    for (let i = 0; i < n; i++) {
      const c = cellOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
      next[i] = head[c]
      head[c] = i
    }
    // the wave's front, sweeping across the flock
    let front = Infinity
    if (this.waveAt >= 0) {
      this.waveAt += dt * WAVE_SPEED
      front = g.x - this.waveDir * (g.spread * 1.4 - this.waveAt)
      if (this.waveAt > g.spread * 2.8) this.waveAt = -1
    }
    const speed = SPEED * (1 + g.panic * 0.7)
    for (let i = 0; i < n; i++) {
      const px = pos[i * 3]
      const py = pos[i * 3 + 1]
      const pz = pos[i * 3 + 2]
      let ax = 0
      let ay = 0
      let az = 0
      let cxs = 0
      let cys = 0
      let czs = 0
      let vxs = 0
      let vys = 0
      let vzs = 0
      let seen = 0
      for (let ox = -1; ox <= 1 && seen < WATCH; ox++)
        for (let oy = -1; oy <= 1 && seen < WATCH; oy++)
          for (let oz = -1; oz <= 1 && seen < WATCH; oz++) {
            for (let j = head[cellOf(px + ox * CELL, py + oy * CELL, pz + oz * CELL)]; j >= 0 && seen < WATCH; j = next[j]) {
              if (j === i) continue
              const dx = pos[j * 3] - px
              const dy = pos[j * 3 + 1] - py
              const dz = pos[j * 3 + 2] - pz
              const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
              if (d > NEAR || d === 0) continue
              seen++
              cxs += dx
              cys += dy
              czs += dz
              vxs += vel[j * 3]
              vys += vel[j * 3 + 1]
              vzs += vel[j * 3 + 2]
              if (d < TOO_CLOSE) {
                const push = ((1 - d / TOO_CLOSE) * 5) / d
                ax -= dx * push
                ay -= dy * push
                az -= dz * push
              }
            }
          }
      const vx = vel[i * 3]
      const vy = vel[i * 3 + 1]
      const vz = vel[i * 3 + 2]
      if (seen) {
        // match the neighbours' heading, drift toward them
        ax += (vxs / seen - vx) * 1.6 + (cxs / seen) * 0.4
        ay += (vys / seen - vy) * 1.6 + (cys / seen) * 0.4
        az += (vzs / seen - vz) * 1.6 + (czs / seen) * 0.4
      }
      // the goal: only felt beyond the flock's edge, so inside they roam
      const gx = g.x - px
      const gy = g.y - py
      const gz = g.z - pz
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1
      const out = Math.max(0, gl - g.spread) * 9
      ax += (gx / gl) * out
      ay += (gy / gl) * out * 1.3
      az += (gz / gl) * out
      if (!g.roosting && py < g.floor + 0.08) ay += (g.floor + 0.08 - py) * 25
      // wheeling round the middle
      ax += -gz * this.swirl * 0.5
      az += gx * this.swirl * 0.5
      // the falcon: bolt away from it
      if (g.hunting) {
        const fx = px - g.fx
        const fy = py - g.fy
        const fz = pz - g.fz
        const fd = Math.sqrt(fx * fx + fy * fy + fz * fz)
        if (fd < 0.35 && fd > 0) {
          const f = ((0.35 - fd) * 14) / fd
          ax += fx * f
          ay += fy * f
          az += fz * f
        }
      }
      let nvx = vx + ax * dt
      let nvy = vy + ay * dt
      let nvz = vz + az * dt
      // the wave's front swerves each bird once as it passes
      if (this.hitWave[i] !== this.wave && Math.abs(px - front) < WAVE_BAND) {
        this.hitWave[i] = this.wave
        const t = this.waveDir * 0.9
        const c = Math.cos(t)
        const s = Math.sin(t)
        const rx = nvx * c - nvz * s
        nvz = nvx * s + nvz * c
        nvx = rx
        nvy -= 0.25
      }
      // starlings keep their speed
      const sp = Math.sqrt(nvx * nvx + nvy * nvy + nvz * nvz) || 1
      const want = sp + (speed - sp) * Math.min(1, dt * 2.5)
      nvx *= want / sp
      nvy *= want / sp
      nvz *= want / sp
      vel[i * 3] = nvx
      vel[i * 3 + 1] = nvy
      vel[i * 3 + 2] = nvz
      pos[i * 3] = px + nvx * dt
      pos[i * 3 + 1] = py + nvy * dt
      pos[i * 3 + 2] = pz + nvz * dt
      // side-on to the camera they look big and dark; end-on, a speck
      const lx = cx - px
      const lz = cz - pz
      const ll = Math.sqrt(lx * lx + lz * lz) || 1
      const along = Math.abs((nvx * lx + nvz * lz) / ll) / want
      this.look[i] = 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - along * along))
    }
  }
}
