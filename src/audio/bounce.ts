import { useSyncExternalStore } from 'react'
import { SPECS } from '../modules'
import { patchStore } from '../patch/store'
import type { ModuleInst } from '../patch/types'
import type { BounceJob, BounceReply } from './bounceWorker'
import { BUFFER_SLOTS, buffers } from './buffers'
import { engine } from './engine'
import { buildPatchMsg } from './patchMsg'
import { encodeWav24 } from './wav'

interface BounceState {
  busy: boolean
  /** 0..1 */
  progress: number
}

/** The reverb's and echoes' tail kept after a song ends (s). */
const TAIL = 4

/** A song's length (s), read from its arranger: every section's bars at its tempo. */
function songSeconds(m: ModuleInst): number {
  const p = m.params
  const len = Math.max(1, Math.round(p.len ?? 1))
  let s = 0
  for (let k = 0; k < len; k++) {
    const bars = Math.max(1, Math.round(p[`b${k}`] ?? 4))
    const own = m.type === 'arrangerxl' ? Math.round(p[`t${k}`] ?? 0) : 0
    const bpm = own > 0 ? own : (p.tempo ?? 120)
    s += (bars * 4 * 60) / bpm
  }
  return s
}

/** The arranger that runs the song, if the rack has one (the big one first). */
export const songOf = (mods: ModuleInst[]): ModuleInst | undefined => mods.find((m) => m.type === 'arrangerxl') ?? mods.find((m) => m.type === 'arranger')

/** Renders the rack offline, in a worker, faster than real time and silently:
 *  the whole song once through (when an ARRANGER or ARRANGER XL leads it) or
 *  a set length, then saves it as a 24-bit WAV. It starts from scratch, as
 *  if POWER had just come on; recordings in loopers and samplers go with it. */
class Bouncer {
  private state: BounceState = { busy: false, progress: 0 }
  private subs = new Set<() => void>()
  private worker: Worker | null = null

  get = (): BounceState => this.state
  subscribe = (fn: () => void) => {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  private set(s: Partial<BounceState>): void {
    this.state = { ...this.state, ...s }
    this.subs.forEach((f) => f())
  }

  /** Bounce `seconds` of the rack, or (null) its song once through. */
  async start(seconds: number | null): Promise<void> {
    if (this.state.busy) return
    this.set({ busy: true, progress: 0 })
    const patch = structuredClone(patchStore.get())
    const song = seconds === null ? songOf(patch.modules) : undefined
    if (song) {
      song.params.loop = 0 // once through, then it stops
      song.params.run = 1
    }
    const msg = buildPatchMsg(patch)
    if (msg.type !== 'patch') return this.set({ busy: false })
    const recs: BounceJob['buffers'] = []
    for (const m of patch.modules)
      for (let s = 0; s < (BUFFER_SLOTS[m.type] ?? 0); s++) {
        const b = await buffers.read(m.id, s)
        if (b?.data.length) recs.push({ id: m.id, slot: s, rate: b.rate, data: b.data.slice() })
      }
    const expected = song ? songSeconds(song) + TAIL : (seconds ?? 60)
    const job: BounceJob = {
      msg,
      buffers: recs,
      rate: engine.getStatus().sampleRate || 48000,
      maxSeconds: song ? expected * 1.15 + 10 : expected,
      watch: song ? { id: song.id, out: SPECS[song.type].outputs.findIndex((o) => o.id === 'end') } : null,
      tail: TAIL,
    }
    const w = new Worker(new URL('./bounceWorker.ts', import.meta.url), { type: 'module' })
    this.worker = w
    w.onmessage = (e: MessageEvent<BounceReply>) => {
      const r = e.data
      if (r.type === 'progress') this.set({ progress: Math.min(0.99, r.seconds / expected) })
      else {
        this.save(r.l, r.r, job.rate, song ? 'song' : `${Math.round(seconds ?? 0)}s`)
        this.finish()
      }
    }
    w.onerror = () => this.finish()
    w.postMessage(job, recs.map((b) => b.data.buffer))
  }

  cancel(): void {
    this.worker?.postMessage('cancel')
    this.finish()
  }

  private finish(): void {
    this.worker?.terminate()
    this.worker = null
    this.set({ busy: false, progress: 0 })
  }

  private save(l: Float32Array, r: Float32Array, rate: number, what: string): void {
    const blob = encodeWav24([l], [r], rate)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const t = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    a.download = `voltage-${what}-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}.wav`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
}

export const bouncer = new Bouncer()

export function useBounce(): BounceState {
  return useSyncExternalStore(bouncer.subscribe, bouncer.get)
}
