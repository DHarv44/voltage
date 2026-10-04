import { useSyncExternalStore } from 'react'
import type { AudioChunkMsg } from '../engine/protocol'
import { engine } from './engine'
import { encodeWav24 } from './wav'

interface RecState {
  recording: boolean
  seconds: number
}

/** Captures the rack's master output (post-limiter, exactly what you hear)
 *  and saves it as a 24-bit WAV when stopped. */
class Recorder {
  private state: RecState = { recording: false, seconds: 0 }
  private subs = new Set<() => void>()
  private L: Float32Array[] = []
  private R: Float32Array[] = []
  private frames = 0
  private done: (() => void) | null = null

  constructor() {
    engine.onAudio = (m) => this.ingest(m)
    engine.beforeSuspend = async () => {
      if (this.state.recording) await this.stop()
    }
  }

  get = (): RecState => this.state
  subscribe = (fn: () => void) => {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  private set(s: Partial<RecState>): void {
    this.state = { ...this.state, ...s }
    this.subs.forEach((f) => f())
  }

  start(): void {
    if (this.state.recording || !engine.getStatus().power) return
    this.L = []
    this.R = []
    this.frames = 0
    engine.send({ type: 'record', on: true })
    this.set({ recording: true, seconds: 0 })
  }

  async stop(): Promise<void> {
    if (!this.state.recording) return
    const flushed = new Promise<void>((res) => (this.done = res))
    engine.send({ type: 'record', on: false })
    await Promise.race([flushed, new Promise((res) => setTimeout(res, 1000))])
    this.set({ recording: false })
    if (this.frames > 0) this.save()
  }

  private ingest(m: AudioChunkMsg): void {
    if (m.l.length) {
      this.L.push(m.l)
      this.R.push(m.r)
      this.frames += m.l.length
      this.set({ seconds: this.frames / engine.getStatus().sampleRate })
    }
    if (m.final) {
      this.done?.()
      this.done = null
    }
  }

  private save(): void {
    const blob = encodeWav24(this.L, this.R, engine.getStatus().sampleRate)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const t = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    a.download = `voltage-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.wav`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    this.L = []
    this.R = []
  }
}

export const recorder = new Recorder()

export function useRecorder(): RecState {
  return useSyncExternalStore(recorder.subscribe, recorder.get)
}
