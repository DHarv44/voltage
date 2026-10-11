import type { BufferMsg } from '../engine/protocol'
import { SCRATCH } from '../patch/persist'
import type { Patch } from '../patch/types'
import { bufferStore, type StoredBuffer } from './bufferStore'
import { engine } from './engine'
import { encodeWav24 } from './wav'

/** Module types that hold a buffer (audio, or XY's recorded gesture), and how many slots each has. */
export const BUFFER_SLOTS: Record<string, number> = { loop: 4, sample: 1, turntable: 1, lpedal: 1, fourtrack: 4, chop: 1, sketchbook: 4, xy: 1, combo: 5, combolooper: 5 }
/** Buffers that aren't sound (no WAV export, not "audio" for share links). */
export const NOT_AUDIO = new Set(['xy'])
/** Does this module type hold audio? */
export const holdsAudio = (type: string): boolean => !!BUFFER_SLOTS[type] && !NOT_AUDIO.has(type)

const MAX_FILE_SECONDS = 60

/** Keeps module audio alive across reloads and undo: persists every change the
 *  engine reports, and re-sends stored audio to any module instance that
 *  (re)appears in the patch. Also handles sample-file loading and WAV export. */
class BufferManager {
  private present = new Set<string>()
  private dumps = new Map<string, (b: BufferMsg) => void>()
  /** Recordings handed in by a .voltage file or a cloud patch: sent to their
   *  modules as they appear (scratch racks too, which keep nothing on disk). */
  private adopted = new Map<string, StoredBuffer>()

  constructor() {
    engine.onBuffer = (m) => {
      const key = `${m.id}/${m.slot}`
      if (m.dump) {
        this.dumps.get(key)?.(m)
        this.dumps.delete(key)
      } else if (!SCRATCH) {
        if (m.data.length) void bufferStore.put(m.id, m.slot, { rate: m.rate, data: m.data })
        else void bufferStore.remove(m.id, m.slot)
      }
    }
    engine.afterPatch = (p) => this.hydrate(p)
  }

  /** Send stored audio to modules that just appeared (new session, undo, preset). */
  private hydrate(p: Patch): void {
    const now = new Set<string>()
    for (const m of p.modules) {
      const slots = BUFFER_SLOTS[m.type]
      if (!slots) continue
      now.add(m.id)
      if (this.present.has(m.id)) continue
      for (let s = 0; s < slots; s++) {
        const own = this.adopted.get(bufferStore.key(m.id, s))
        if (own) engine.send({ type: 'buffer', id: m.id, slot: s, rate: own.rate, data: own.data.slice() })
        else if (!SCRATCH)
          void bufferStore.get(m.id, s).then((b) => {
            if (b?.data.length) engine.send({ type: 'buffer', id: m.id, slot: s, rate: b.rate, data: b.data })
          })
      }
    }
    this.present = now
  }

  /** Take in recordings for modules of a patch about to load (call before
   *  loading it): kept on disk for your own rack, in memory for a scratch one. */
  adopt(list: { id: string; slot: number; rate: number; data: Float32Array }[]): void {
    for (const b of list) {
      this.adopted.set(bufferStore.key(b.id, b.slot), { rate: b.rate, data: b.data })
      this.present.delete(b.id) // so the next patch sends it, even to a module already here
      if (!SCRATCH) void bufferStore.put(b.id, b.slot, { rate: b.rate, data: b.data })
    }
  }

  /** A module slot's recording: from disk, or (scratch racks, or not saved yet)
   *  straight from the running engine. */
  async read(id: string, slot: number): Promise<StoredBuffer | null> {
    const own = this.adopted.get(bufferStore.key(id, slot))
    if (!SCRATCH) {
      const b = await bufferStore.get(id, slot)
      if (b?.data.length) return b
    }
    if (engine.getStatus().power) {
      const b = await new Promise<BufferMsg>((resolve) => {
        this.dumps.set(`${id}/${slot}`, resolve)
        engine.send({ type: 'getBuffer', id, slot })
      })
      if (b.data.length) return { rate: b.rate, data: b.data }
    }
    return own ?? null
  }

  /** Decode an audio file, mix to mono, and load it into a module slot. */
  async loadFile(id: string, slot: number, file: File): Promise<string | null> {
    try {
      const rate = engine.getStatus().sampleRate || 48000
      const ctx = new OfflineAudioContext(1, 1, rate)
      const audio = await ctx.decodeAudioData(await file.arrayBuffer())
      const n = Math.min(audio.length, Math.round(MAX_FILE_SECONDS * audio.sampleRate))
      const data = new Float32Array(n)
      for (let c = 0; c < audio.numberOfChannels; c++) {
        const ch = audio.getChannelData(c)
        for (let i = 0; i < n; i++) data[i] += ch[i] / audio.numberOfChannels
      }
      if (!SCRATCH) await bufferStore.put(id, slot, { rate: audio.sampleRate, data: data.slice() })
      engine.send({ type: 'buffer', id, slot, rate: audio.sampleRate, data })
      return null
    } catch (err) {
      return `Couldn't read that file (${String(err)})`
    }
  }

  /** Copy a module's audio out of the engine and download it as a WAV. */
  async exportWav(id: string, slot: number, name: string): Promise<boolean> {
    if (!engine.getStatus().power) return false
    const b = await new Promise<BufferMsg>((resolve) => {
      this.dumps.set(`${id}/${slot}`, resolve)
      engine.send({ type: 'getBuffer', id, slot })
    })
    if (!b.data.length) return false
    const blob = encodeWav24([b.data], [b.data], b.rate)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name}.wav`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    return true
  }
}

export const buffers = new BufferManager()
