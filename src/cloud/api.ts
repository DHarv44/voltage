import { pack, unpack, type Bundle } from '../patch/bundle'

/** The cloud from the app's side. No accounts: each browser has a random
 *  owner key (kept here, sent with requests; the server only stores its hash)
 *  that owns the racks it saves. */
export type Visibility = 'private' | 'unlisted' | 'public'
export type Status = 'none' | 'pending' | 'approved' | 'rejected'
export interface CloudMeta {
  id: string
  title: string
  note: string
  visibility: Visibility
  status: Status
  size: number
  modules: number
  created: number
  updated: number
  opens: number
  reports: number
  mine?: boolean
}

const OWNER = 'voltage.owner.v1'
const ADMIN = 'voltage.admin.v1'

function randomKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** This browser's owner key (made the first time it's needed). */
export function ownerKey(): string {
  try {
    let k = localStorage.getItem(OWNER)
    if (!k) {
      k = randomKey()
      localStorage.setItem(OWNER, k)
    }
    return k
  } catch {
    return randomKey() // storage blocked: this session only
  }
}
export const hasOwnerKey = () => {
  try {
    return !!localStorage.getItem(OWNER)
  } catch {
    return false
  }
}
export const validKey = (k: string) => /^[A-Za-z0-9_-]{32,128}$/.test(k.trim())

export const adminKey = {
  get: (): string => {
    try {
      return localStorage.getItem(ADMIN) ?? ''
    } catch {
      return ''
    }
  },
  set: (k: string) => {
    try {
      if (k) localStorage.setItem(ADMIN, k)
      else localStorage.removeItem(ADMIN)
    } catch {
      /* not kept */
    }
  },
}

export const shortLink = (id: string) => `${location.origin}/p/${id}`

async function call<T>(path: string, init: RequestInit & { admin?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-Owner-Key', ownerKey())
  if (init.admin) headers.set('X-Admin-Key', adminKey.get())
  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers })
  } catch {
    throw new Error('Can’t reach the VOLTAGE server (are you offline?).')
  }
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => '')
    throw new Error(msg || `The server said no (${res.status}).`)
  }
  return (res.headers.get('Content-Type')?.includes('json') ? res.json() : res.arrayBuffer()) as Promise<T>
}

const query = (o: Record<string, string>) => new URLSearchParams(o).toString()

export const cloud = {
  /** Upload a new rack (recordings and all). */
  async save(b: Bundle, title: string, note: string, visibility: Visibility): Promise<CloudMeta> {
    return call(`/patches?${query({ title, note, visibility })}`, { method: 'POST', headers: { 'Content-Type': 'application/x-voltage' }, body: await pack(b) })
  },
  /** Replace one of yours with the rack as it is now. */
  async update(id: string, b: Bundle, title: string, note: string, visibility: Visibility): Promise<CloudMeta> {
    return call(`/patches/${id}?${query({ title, note, visibility })}`, { method: 'PUT', headers: { 'Content-Type': 'application/x-voltage' }, body: await pack(b) })
  },
  describe: (id: string, title: string, note: string, visibility: Visibility) =>
    call<CloudMeta>(`/patches/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, note, visibility }) }),
  info: (id: string) => call<CloudMeta>(`/patches/${id}/info`),
  async open(id: string): Promise<Bundle | null> {
    return unpack(new Uint8Array(await call<ArrayBuffer>(`/patches/${id}`)))
  },
  remove: (id: string, admin = false) => call<{ ok: boolean }>(`/patches/${id}`, { method: 'DELETE', admin }),
  mine: () => call<CloudMeta[]>('/mine'),
  gallery: (q: string, sort: 'new' | 'top', offset = 0) => call<CloudMeta[]>(`/gallery?${query({ q, sort, offset: String(offset) })}`),
  report: (id: string, reason: string) => call(`/patches/${id}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }),
  /** Use a key from another device here: this browser's racks move to it first. */
  async adopt(key: string): Promise<number> {
    const k = key.trim()
    const r = await call<{ moved: number }>('/owner/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }) })
    localStorage.setItem(OWNER, k)
    return r.moved
  },
  admin: {
    check: () => call<{ admin: boolean }>('/admin/check', { admin: true }),
    queue: () => call<{ stats: { patches: number; bytes: number }; queue: (CloudMeta & { why: { reason: string; at: number }[] })[] }>('/admin/queue', { admin: true }),
    approve: (id: string) => call<CloudMeta>(`/patches/${id}/approve`, { method: 'POST', admin: true }),
    reject: (id: string) => call<CloudMeta>(`/patches/${id}/reject`, { method: 'POST', admin: true }),
  },
}
