import { engine } from '../engine'
import type { InputStatus } from './mic'

type Fn = () => void
const W = 64
const H = 48
const FPS = 30

/** Webcam motion sensing for CAMERA modules. Only switched on from a module's
 *  ENABLE; frames are analysed here in the page (a 64×48 thumbnail) and never
 *  stored or sent anywhere. Each frame: how much moved, where the movement
 *  is, and how bright the scene is. */
class CameraInput {
  status: InputStatus = 'off'
  readonly video: HTMLVideoElement
  private stream: MediaStream | null = null
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D | null
  private prev = new Float32Array(W * H)
  private timer = 0
  private readonly modules = new Set<string>()
  private subs = new Set<Fn>()
  /** Latest analysis, for the panel preview. */
  motion = 0
  cx = 0.5
  cy = 0.5
  bright = 0

  constructor() {
    this.video = document.createElement('video')
    this.video.muted = true
    this.video.playsInline = true
    this.canvas = document.createElement('canvas')
    this.canvas.width = W
    this.canvas.height = H
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
  }

  subscribe(fn: Fn): () => void {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  /** A CAMERA module on the rack that wants the readings. */
  register(id: string): () => void {
    this.modules.add(id)
    return () => {
      this.modules.delete(id)
      if (!this.modules.size) this.disable()
    }
  }

  private set(status: InputStatus): void {
    this.status = status
    this.subs.forEach((f) => f())
  }

  async enable(): Promise<void> {
    if (this.status === 'on' || this.status === 'asking') return
    if (!navigator.mediaDevices?.getUserMedia) return this.set('error')
    this.set('asking')
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      this.video.srcObject = this.stream
      await this.video.play()
      this.timer = window.setInterval(() => this.analyse(), 1000 / FPS)
      this.set('on')
    } catch (err) {
      this.set((err as Error).name === 'NotAllowedError' ? 'denied' : 'error')
    }
  }

  disable(): void {
    window.clearInterval(this.timer)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.srcObject = null
    this.set('off')
  }

  private analyse(): void {
    const ctx = this.ctx
    if (!ctx || this.video.readyState < 2) return
    ctx.drawImage(this.video, 0, 0, W, H)
    const px = ctx.getImageData(0, 0, W, H).data
    let motion = 0
    let mx = 0
    let my = 0
    let bright = 0
    for (let i = 0; i < W * H; i++) {
      const lum = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255
      const d = Math.abs(lum - this.prev[i])
      this.prev[i] = lum
      bright += lum
      if (d > 0.06) {
        motion += d
        // mirrored, so moving your right hand moves X right (like a mirror)
        mx += (1 - (i % W) / W) * d
        my += (1 - Math.floor(i / W) / H) * d
      }
    }
    this.bright = bright / (W * H)
    this.motion = Math.min(1, motion / (W * H) * 12)
    if (motion > 0.5) {
      this.cx += (mx / motion - this.cx) * 0.4
      this.cy += (my / motion - this.cy) * 0.4
    }
    for (const id of this.modules) {
      engine.ui(id, { kind: 'surface', name: 'cam', x: this.motion, y: this.bright, down: true })
      engine.ui(id, { kind: 'surface', name: 'campos', x: this.cx, y: this.cy, down: true })
    }
  }
}

export const cameraInput = new CameraInput()
