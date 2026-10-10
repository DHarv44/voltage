import { randomInt } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { gunzipSync } from 'node:zlib'
import type { Status, Store, Visibility } from './db.ts'
import { body, HttpError, ip, json, jsonBody, Limiter, ownerOf, same, sha256 } from './http.ts'

/** Biggest bundle (gzipped) we take, and how far it may unpack. */
const MAX_BYTES = 20_000_000
const MAX_UNPACKED = 120_000_000
const ID_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const VIS: Visibility[] = ['private', 'unlisted', 'public']

const uploads = new Limiter(30, 3_600_000)
const reports = new Limiter(20, 3_600_000)
const reads = new Limiter(600, 60_000)

const newId = () => Array.from({ length: 8 }, () => ID_CHARS[randomInt(ID_CHARS.length)]).join('')
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const vis = (v: unknown): Visibility => (VIS.includes(v as Visibility) ? (v as Visibility) : 'unlisted')

/** Check an upload really is a VOLTAGE bundle; how many modules it has. */
function inspect(bytes: Uint8Array): number {
  try {
    const raw = JSON.parse(new TextDecoder().decode(gunzipSync(bytes, { maxOutputLength: MAX_UNPACKED }))) as { magic?: unknown; patch?: { modules?: unknown } }
    if (raw.magic !== 'voltage-bundle' || !Array.isArray(raw.patch?.modules)) throw new Error()
    return raw.patch.modules.length
  } catch {
    throw new HttpError(400, 'That isn’t a VOLTAGE rack.')
  }
}

function needOwner(req: IncomingMessage): string {
  const o = ownerOf(req)
  if (!o) throw new HttpError(401, 'Missing the owner key.')
  return o
}

/** The admin key from the request, if it matches ADMIN_KEY. */
function isAdmin(req: IncomingMessage, adminKey: string): boolean {
  const k = req.headers['x-admin-key']
  const key = Array.isArray(k) ? k[0] : k
  return !!adminKey && !!key && same(key, adminKey)
}

/** /api/…: patches, the gallery, reports and the admin queue. */
export async function api(req: IncomingMessage, res: ServerResponse, url: URL, store: Store, adminKey: string): Promise<void> {
  const path = url.pathname.replace(/^\/api/, '')
  const method = req.method ?? 'GET'
  const who = ip(req)
  const m = path.match(/^\/patches\/([A-Za-z0-9]{8})(\/[a-z]+)?$/)
  const id = m?.[1]
  const sub = m?.[2] ?? ''
  const admin = isAdmin(req, adminKey)

  // save a new rack
  if (path === '/patches' && method === 'POST') {
    const owner = needOwner(req)
    uploads.check(who)
    const data = await body(req, MAX_BYTES)
    const modules = inspect(data)
    const nid = newId()
    store.insert({ id: nid, owner, title: clip(url.searchParams.get('title'), 80), note: clip(url.searchParams.get('note'), 400), visibility: vis(url.searchParams.get('visibility')), data, modules })
    return json(res, 201, store.meta(nid))
  }

  if (id) {
    const row = store.owner(id)
    if (!row) throw new HttpError(404, 'No such rack (it may have been deleted).')
    const mine = ownerOf(req) === row.owner
    if (method === 'GET' && (sub === '' || sub === '/info')) {
      reads.check(who)
      if (row.visibility === 'private' && !mine && !admin) throw new HttpError(404, 'No such rack (it may have been deleted).')
      if (sub === '/info') return json(res, 200, { ...store.meta(id), mine })
      const data = store.open(id)!
      res.writeHead(200, { 'Content-Type': 'application/x-voltage', 'Cache-Control': 'no-store' })
      return void res.end(data)
    }
    if (sub === '/report' && method === 'POST') {
      reports.check(who)
      const b = await jsonBody<{ reason?: unknown }>(req)
      store.report(id, clip(b.reason, 500) || '(no reason given)')
      return json(res, 200, { ok: true })
    }
    if (sub === '/approve' || sub === '/reject') {
      if (!admin) throw new HttpError(403, 'Admins only.')
      store.setStatus(id, (sub === '/approve' ? 'approved' : 'rejected') satisfies Status)
      return json(res, 200, store.meta(id))
    }
    if (sub === '' && method === 'DELETE') {
      if (!mine && !admin) throw new HttpError(403, 'That rack isn’t yours.')
      store.remove(id)
      return json(res, 200, { ok: true })
    }
    if (!mine) throw new HttpError(403, 'That rack isn’t yours.')
    if (sub === '' && method === 'PUT') {
      uploads.check(who)
      const data = await body(req, MAX_BYTES)
      const modules = inspect(data)
      store.replace(id, { title: clip(url.searchParams.get('title'), 80), note: clip(url.searchParams.get('note'), 400), visibility: vis(url.searchParams.get('visibility')), data, modules })
      return json(res, 200, store.meta(id))
    }
    if (sub === '' && method === 'PATCH') {
      const b = await jsonBody<{ title?: unknown; note?: unknown; visibility?: unknown }>(req)
      store.describe(id, clip(b.title, 80), clip(b.note, 400), vis(b.visibility), row.visibility === 'public', row.status)
      return json(res, 200, store.meta(id))
    }
  }

  if (path === '/mine' && method === 'GET') return json(res, 200, store.mine(needOwner(req)))

  // a key brought from another device: this browser's racks move to it
  if (path === '/owner/merge' && method === 'POST') {
    const owner = needOwner(req)
    const b = await jsonBody<{ key?: unknown }>(req)
    if (typeof b.key !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(b.key)) throw new HttpError(400, 'That code doesn’t look right.')
    return json(res, 200, { moved: store.reassign(owner, sha256(b.key)) })
  }

  if (path === '/gallery' && method === 'GET') {
    reads.check(who)
    const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'new'
    const offset = Math.max(0, Math.min(10_000, Number(url.searchParams.get('offset')) || 0))
    return json(res, 200, store.gallery(clip(url.searchParams.get('q'), 60), sort, offset, 40))
  }

  if (path === '/admin/queue' && method === 'GET') {
    if (!admin) throw new HttpError(403, 'Admins only.')
    return json(res, 200, { stats: store.stats(), queue: store.queue().map((p) => ({ ...p, why: store.reasons(p.id) })) })
  }
  if (path === '/admin/check' && method === 'GET') return json(res, 200, { admin })

  throw new HttpError(404, 'Not found.')
}
