import { BUFFER_SLOTS, buffers } from '../audio/buffers'
import { sanitize } from './persist'
import type { Patch } from './types'

/** A whole rack in one file: the patch and every recording in it (LOOP,
 *  SAMPLE, tape, CHOP, XY gestures…), gzipped. Also the cloud's upload format. */
export interface Recording {
  id: string
  slot: number
  rate: number
  data: Float32Array
}
export interface Bundle {
  patch: Patch
  recordings: Recording[]
  title?: string
  note?: string
}

const VERSION = 1
const MAGIC = 'voltage-bundle'

const toB64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())
}

/** Every recording the patch's modules hold right now. */
export async function collectRecordings(patch: Patch): Promise<Recording[]> {
  const out: Recording[] = []
  for (const m of patch.modules) {
    const slots = BUFFER_SLOTS[m.type] ?? 0
    for (let s = 0; s < slots; s++) {
      const b = await buffers.read(m.id, s)
      if (b?.data.length) out.push({ id: m.id, slot: s, rate: b.rate, data: b.data })
    }
  }
  return out
}

/** Pack a bundle into gzipped bytes. */
export async function pack(b: Bundle): Promise<Blob> {
  const json = JSON.stringify({
    magic: MAGIC,
    v: VERSION,
    title: b.title,
    note: b.note,
    patch: b.patch,
    recordings: b.recordings.map((r) => ({ id: r.id, slot: r.slot, rate: r.rate, data: toB64(new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength)) })),
  })
  return new Blob([await pipe(new TextEncoder().encode(json), new CompressionStream('gzip'))], { type: 'application/x-voltage' })
}

/** Unpack a bundle (or, for older files, a plain patch JSON). Null if it's
 *  neither: everything goes through the same checks as an import. */
export async function unpack(bytes: Uint8Array<ArrayBuffer>): Promise<Bundle | null> {
  try {
    const gz = bytes[0] === 0x1f && bytes[1] === 0x8b
    const raw = JSON.parse(new TextDecoder().decode(gz ? await pipe(bytes, new DecompressionStream('gzip')) : bytes)) as Record<string, unknown>
    if (raw.magic !== MAGIC) {
      const patch = sanitize(raw)
      return patch ? { patch, recordings: [] } : null
    }
    const patch = sanitize(raw.patch)
    if (!patch) return null
    const ids = new Set(patch.modules.map((m) => m.id))
    const recordings: Recording[] = []
    for (const r of Array.isArray(raw.recordings) ? raw.recordings : []) {
      const x = r as { id?: unknown; slot?: unknown; rate?: unknown; data?: unknown }
      if (typeof x.id !== 'string' || !ids.has(x.id) || typeof x.slot !== 'number' || typeof x.rate !== 'number' || typeof x.data !== 'string') continue
      const bytesIn = fromB64(x.data)
      recordings.push({ id: x.id, slot: x.slot, rate: x.rate, data: new Float32Array(bytesIn.buffer, 0, Math.floor(bytesIn.byteLength / 4)) })
    }
    return { patch, recordings, title: typeof raw.title === 'string' ? raw.title.slice(0, 80) : undefined, note: typeof raw.note === 'string' ? raw.note.slice(0, 400) : undefined }
  } catch {
    return null
  }
}

/** Download the current rack as a .voltage file. */
export async function exportRack(patch: Patch, name = 'voltage-rack'): Promise<void> {
  const blob = await pack({ patch, recordings: await collectRecordings(patch) })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}.voltage`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
