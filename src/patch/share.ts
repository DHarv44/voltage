import { SPECS } from '../modules'
import { holdsAudio } from '../audio/buffers'
import { sanitize } from './persist'
import type { Patch } from './types'

/** A patch packed into a link: `…/#p=<data>`. Everything after # stays in the
 *  browser (it's never sent to the server), so a shared patch goes only where
 *  the link goes. Recorded audio (LOOP, SAMPLE…) is too big for a link. */
export interface Shared {
  patch: Patch
  title: string
  note: string
  /** The original had recordings that the link couldn't carry. */
  hadAudio: boolean
}

const HASH_KEY = 'p'
const VERSION = 1

/** Only what differs from a fresh module: knobs at their defaults are left out
 *  (a POCKET alone has 256 step locks, usually untouched). */
function compact(p: Patch) {
  return {
    rows: p.rows,
    rail: p.rail,
    modules: p.modules.map((m) => {
      const spec = SPECS[m.type]
      const params: Record<string, number> = {}
      for (const ps of spec?.params ?? []) {
        const v = m.params[ps.id]
        if (v !== undefined && v !== ps.def) params[ps.id] = v // exact: it should arrive as sent
      }
      return { id: m.id, type: m.type, row: m.row, hp: m.hp, seed: m.seed, params, width: m.width, morph: m.morph }
    }),
    cables: p.cables,
  }
}

const toB64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64 = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

/** The link for a patch (on whatever address the app is running from). */
export async function shareLink(patch: Patch, title: string, note: string): Promise<string> {
  const hadAudio = patch.modules.some((m) => holdsAudio(m.type))
  const body = JSON.stringify({ v: VERSION, t: title.trim().slice(0, 80), n: note.trim().slice(0, 400), a: hadAudio ? 1 : 0, p: compact(patch) })
  const packed = await pipe(new TextEncoder().encode(body), new CompressionStream('deflate-raw'))
  return `${location.origin}${location.pathname}#${HASH_KEY}=${toB64(packed)}`
}

/** The packed patch in this page's address, if there is one. */
export function sharedInHash(): string | null {
  const m = location.hash.match(new RegExp(`^#${HASH_KEY}=([A-Za-z0-9_-]+)$`))
  return m ? m[1] : null
}

/** Unpack a link's data. Null if it's damaged or not a VOLTAGE patch: it goes
 *  through the same checks as an imported file. */
export async function openShared(data: string): Promise<Shared | null> {
  try {
    const json = new TextDecoder().decode(await pipe(fromB64(data), new DecompressionStream('deflate-raw')))
    const raw = JSON.parse(json) as { v?: number; t?: unknown; n?: unknown; a?: unknown; p?: unknown }
    if (raw.v !== VERSION) return null
    const patch = sanitize(raw.p) // fills every left-out knob with its default
    if (!patch) return null
    return {
      patch,
      title: typeof raw.t === 'string' ? raw.t.slice(0, 80) : '',
      note: typeof raw.n === 'string' ? raw.n.slice(0, 400) : '',
      hadAudio: raw.a === 1,
    }
  } catch {
    return null
  }
}
