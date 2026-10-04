import type { ModuleSpec } from '../../modules/types'
import { XYL } from '../../modules/specs/xy'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'
import { Schmitt } from './cores'
import { SCALES } from './shapers'
import { GestureLoop, LOOP_RATE } from './xyLoop'

const BLOCK = 32
const FREE = 0
const SPRING = 1
const FLING = 2
/** Joystick return spring (rad/s), finger-tracking time (s), wall bounce. */
const SPRING_W = 14
const TRACK = 0.012
const BOUNCE = 0.82

/** XY pad. The dot is a little physical object: held, it follows the finger;
 *  released it stays (FREE), springs home (SPRING) or slides on with momentum
 *  and bounces off the frame (FLING, friction = GLIDE). */
export class XyDsp extends Dsp {
  private readonly pMode = this.pi('mode')
  private readonly pScale = this.pi('scale')
  private readonly pRange = this.pi('range')
  private readonly pGlide = this.pi('glide')
  private readonly iX = this.ii('x')
  private readonly iY = this.ii('y')
  private readonly iClk = this.ii('clk')
  private readonly clk = new Schmitt()
  private readonly loop = new GestureLoop()
  private readonly frame = new Float64Array(4)
  /** Output voltages from the last control step; glided per sample. */
  private readonly goal = new Float64Array(8)
  private readonly glide: number
  private readonly dt: number
  private readonly recEvery: number
  private n = 0
  private recN = 0
  private edge = false
  private held = false
  private tx = 0.5
  private ty = 0.5
  private tp = 0
  private x = 0.5
  private y = 0.5
  private vx = 0
  private vy = 0
  private speed = 0
  private blink = 0

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.dt = BLOCK / fs
    this.recEvery = Math.max(1, Math.round(fs / BLOCK / LOOP_RATE))
    this.glide = 1 - Math.exp(-1 / (0.002 * fs))
  }

  onUi(ev: UiEvent): void {
    if (ev.kind === 'xy') {
      this.held = ev.down
      if (ev.down) {
        this.tx = Math.min(1, Math.max(0, ev.x))
        this.ty = Math.min(1, Math.max(0, ev.y))
        this.tp = Math.min(1, Math.max(0, ev.p))
      } else this.tp = 0
    } else if (ev.kind === 'button' && ev.down) {
      if (ev.name === 'rec') this.loop.arm()
      else if (ev.name === 'play') this.loop.toggle()
    }
  }

  private gateNow = false
  private presNow = 0

  /** Moves the dot one control step; sets gateNow/presNow (no allocation on the audio thread). */
  private move(dt: number): void {
    this.gateNow = false
    this.presNow = 0
    const px = this.x
    const py = this.y
    const loop = this.loop
    if (this.held) {
      const k = 1 - Math.exp(-dt / TRACK)
      this.x += (this.tx - this.x) * k
      this.y += (this.ty - this.y) * k
      const a = 1 - Math.exp(-dt / 0.03)
      this.vx += ((this.x - px) / dt - this.vx) * a
      this.vy += ((this.y - py) / dt - this.vy) * a
      this.gateNow = true
      this.presNow = this.tp
      return
    }
    if (loop.playing && loop.len) {
      loop.read(this.frame)
      this.x = this.frame[0]
      this.y = this.frame[1]
      this.vx = (this.x - px) / dt
      this.vy = (this.y - py) / dt
      this.gateNow = this.frame[3] > 0.5
      this.presNow = this.frame[2]
      return
    }
    const cvX = this.patched[this.iX] === 1
    const cvY = this.patched[this.iY] === 1
    const mode = Math.round(this.p[this.pMode])
    if (mode === SPRING) {
      this.vx += (SPRING_W * SPRING_W * (0.5 - this.x) - 2 * SPRING_W * this.vx) * dt
      this.vy += (SPRING_W * SPRING_W * (0.5 - this.y) - 2 * SPRING_W * this.vy) * dt
    } else if (mode === FLING) {
      const f = Math.exp(-dt / this.p[this.pGlide])
      this.vx *= f
      this.vy *= f
    } else {
      this.vx = 0
      this.vy = 0
    }
    this.x += this.vx * dt
    this.y += this.vy * dt
    if (this.x < 0 || this.x > 1) {
      this.x = this.x < 0 ? -this.x : 2 - this.x
      this.vx *= -BOUNCE
    }
    if (this.y < 0 || this.y > 1) {
      this.y = this.y < 0 ? -this.y : 2 - this.y
      this.vy *= -BOUNCE
    }
    // Patched CV moves the dot (−5..+5 V across the pad); the hand always wins.
    if (cvX) this.x = Math.min(1, Math.max(0, 0.5 + this.in[this.iX] / 10))
    if (cvY) this.y = Math.min(1, Math.max(0, 0.5 + this.in[this.iY] / 10))
  }

  private pitch(): number {
    const scale = SCALES[Math.round(this.p[this.pScale])] ?? SCALES[0]
    const count = Math.round(this.p[this.pRange]) * scale.length + 1
    const idx = Math.min(count - 1, Math.floor(this.x * count))
    const oct = Math.floor(idx / scale.length)
    return oct + scale[idx % scale.length] / 12
  }

  tick(): void {
    if (this.clk.rise(this.in[this.iClk])) this.edge = true
    if (++this.n >= BLOCK) {
      this.n = 0
      const dt = this.dt
      this.loop.clock(dt, this.edge, this.patched[this.iClk] === 1)
      this.edge = false
      this.move(dt)
      const gate = this.gateNow
      const pres = this.presNow
      if (++this.recN >= this.recEvery) {
        this.recN = 0
        this.loop.record(this.x, this.y, this.tp, this.held)
      }
      this.speed += (Math.hypot(this.vx, this.vy) - this.speed) * (1 - Math.exp(-dt / 0.05))
      const dx = this.x - 0.5
      const dy = this.y - 0.5
      const t = this.goal
      t[0] = this.x * 10
      t[1] = this.y * 10
      t[2] = gate ? 10 : 0
      t[3] = pres * 10
      t[4] = Math.min(10, this.speed * 2.5)
      t[5] = Math.min(10, Math.hypot(dx, dy) * 14.142)
      t[6] = ((Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1) * 10
      t[7] = this.pitch()

      this.blink = (this.blink + dt * 3) % 1
      const led = this.led
      led[XYL.x] = this.x
      led[XYL.y] = this.y
      led[XYL.gate] = gate ? 1 : 0
      led[XYL.rec] = this.loop.state === 2 ? 1 : this.loop.state === 1 ? (this.blink < 0.5 ? 1 : 0.15) : 0
      led[XYL.play] = this.loop.playing ? 1 : 0
      led[XYL.pos] = this.loop.progress()
      led[XYL.pres] = pres
    }
    const o = this.out
    const t = this.goal
    o[2] = t[2] // gate and pitch are steps by nature
    o[7] = t[7]
    const g = this.glide
    o[0] += (t[0] - o[0]) * g
    o[1] += (t[1] - o[1]) * g
    o[3] += (t[3] - o[3]) * g
    o[4] += (t[4] - o[4]) * g
    o[5] += (t[5] - o[5]) * g
    o[6] = t[6] // angle wraps: never glide across the seam
  }
}
