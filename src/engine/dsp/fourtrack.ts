import type { ModuleSpec } from '../../modules/types'
import { FT_SECONDS, FT_TRACKS, FTL } from '../../modules/specs/fourtrack'
import type { UiEvent } from '../protocol'
import { Dsp } from './base'

const STOP = 0
const PLAY = 1
const REW = 2
const MOTOR_TAU = 0.15
const REW_SPEED = -12

/** Four-track tape. One head position for all tracks; the motor has inertia so
 *  starts, stops and speed changes slur the pitch like a real transport. */
export class FourTrackDsp extends Dsp {
  private readonly iIn = Array.from({ length: FT_TRACKS }, (_, i) => this.ii(`in${i + 1}`))
  private readonly pLvl = Array.from({ length: FT_TRACKS }, (_, i) => this.pi(`lvl${i + 1}`))
  private readonly pVari = this.pi('vari')
  private readonly pRev = this.pi('rev')
  private readonly pLoop = this.pi('loop')
  private readonly tracks: Float32Array[]
  private readonly armed = new Uint8Array(FT_TRACKS)
  private readonly dirty = new Uint8Array(FT_TRACKS)
  private readonly lp = new Float64Array(FT_TRACKS)
  private readonly len: number
  private state = STOP
  private recording = false
  private head = 0
  private speed = 0
  private lastW = -1
  private end = 0
  private recLoop = 0
  private hiss = 0
  private seed = 7
  private readonly motor: number

  constructor(spec: ModuleSpec, fs: number, seed: number) {
    super(spec, fs, seed)
    this.len = FT_SECONDS * fs
    this.tracks = Array.from({ length: FT_TRACKS }, () => new Float32Array(this.len))
    this.motor = 1 - Math.exp(-1 / (MOTOR_TAU * fs))
  }

  onUi(ev: UiEvent): void {
    if (ev.kind !== 'button' || !ev.down) return
    if (ev.name === 'play') this.state = PLAY
    else if (ev.name === 'stop') {
      this.punchOut()
      this.state = STOP
    } else if (ev.name === 'rew') {
      this.punchOut()
      this.state = this.state === REW ? STOP : REW
    } else if (ev.name === 'rec') {
      if (this.recording) this.punchOut()
      else if (this.armed.some((a) => a === 1)) {
        this.recording = true
        this.recLoop = this.end
        this.lastW = -1
        if (this.state !== PLAY) this.state = PLAY
      }
    } else if (ev.name.startsWith('arm')) {
      const t = Number(ev.name.slice(3)) - 1
      if (t >= 0 && t < FT_TRACKS) this.armed[t] ^= 1
    }
  }

  private punchOut(): void {
    if (!this.recording) return
    this.recording = false
    const n = Math.min(this.len, Math.ceil(this.end))
    for (let t = 0; t < FT_TRACKS; t++)
      if (this.dirty[t]) {
        this.bufferOut.push({ slot: t, rate: this.fs, data: this.tracks[t].subarray(0, n) })
        this.dirty[t] = 0
      }
  }

  loadBuffer(slot: number, rate: number, data: Float32Array): void {
    if (slot < 0 || slot >= FT_TRACKS || rate !== this.fs) return
    const n = Math.min(this.len, data.length)
    this.tracks[slot].set(data.subarray(0, n))
    this.end = Math.max(this.end, n)
  }

  dumpBuffer(slot: number): { rate: number; data: Float32Array } | null {
    const n = Math.ceil(this.end)
    return slot >= 0 && slot < FT_TRACKS && n ? { rate: this.fs, data: this.tracks[slot].slice(0, n) } : null
  }

  tick(): void {
    const p = this.p
    const target = this.state === PLAY ? p[this.pVari] * (p[this.pRev] >= 0.5 ? -1 : 1) : this.state === REW ? REW_SPEED : 0
    this.speed += (target - this.speed) * this.motor
    this.head += this.speed

    // Ends of the tape: loop over what's recorded, or stop.
    // While recording, the loop is whatever existed at punch-in (a fresh tape runs on).
    const loopLen = this.recording ? this.recLoop : this.end
    const looping = p[this.pLoop] >= 0.5 && loopLen > this.fs
    const loopEnd = looping ? loopLen : this.len - 1
    if (this.head >= loopEnd) {
      if (looping) this.head -= loopEnd
      else {
        this.head = loopEnd - 1
        this.punchOut()
        this.state = STOP
      }
    } else if (this.head < 0) {
      if (this.state === REW || p[this.pLoop] < 0.5) {
        this.head = 0
        if (this.state === REW) this.state = STOP
      } else if (looping) this.head += loopEnd
      else this.head = 0
    }

    const i = Math.floor(this.head)
    const f = this.head - i
    const j = Math.min(this.len - 1, i + 1)
    const lifted = this.state === REW // tape lifters: no sound while winding
    const moving = Math.min(1, Math.abs(this.speed))
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
    this.hiss += (this.seed / 2147483648 - this.hiss) * 0.5
    let mix = 0
    for (let t = 0; t < FT_TRACKS; t++) {
      const tr = this.tracks[t]
      let y = lifted ? 0 : (tr[i] * (1 - f) + tr[j] * f) * moving
      // head gap loss: a gentle roll-off that tracks tape speed
      this.lp[t] += (y - this.lp[t]) * Math.min(1, 0.55 * Math.max(0.2, Math.abs(this.speed)))
      y = this.lp[t] + this.hiss * 0.0015 * moving
      const v = y * 5 * p[this.pLvl[t]]
      this.out[t] = v
      mix += v
    }
    this.out[FT_TRACKS] = mix * 0.5

    if (this.recording && this.state === PLAY) {
      // Erase-then-record on armed tracks; fill every sample the head passed.
      const w = Math.min(this.len - 1, Math.max(0, Math.floor(this.head)))
      const from = this.lastW < 0 || Math.abs(w - this.lastW) > this.fs ? w : this.lastW
      for (let t = 0; t < FT_TRACKS; t++) {
        if (!this.armed[t]) continue
        const v = Math.tanh((this.in[this.iIn[t]] / 5) * 1.3) / 1.3 // tape compression
        const step = w >= from ? 1 : -1
        for (let k = from; k !== w + step; k += step) this.tracks[t][k] = v
        this.dirty[t] = 1
      }
      this.lastW = w
      this.end = Math.max(this.end, w + 1)
    }

    const led = this.led
    led[FTL.head] = this.head / this.fs
    led[FTL.play] = this.state === PLAY ? 1 : 0
    led[FTL.rec] = this.recording ? 1 : 0
    led[FTL.speed] = this.speed
    for (let t = 0; t < FT_TRACKS; t++) led[FTL.arm0 + t] = this.armed[t] ? (this.recording ? 1 : 0.45) : 0
  }
}
