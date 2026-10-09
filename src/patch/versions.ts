import { SCRATCH } from './persist'
import type { Patch } from './types'

/** Version history of your own rack: a snapshot when the page opens and then
 *  every couple of minutes while it changes, the last KEEP kept, in
 *  IndexedDB (too big for localStorage). Scratch racks keep none. Recordings
 *  aren't copied: they live on in the audio store under their modules. */
export interface Version {
  id?: number
  t: number
  patch: Patch
}

const DB = 'voltage-history'
const STORE = 'versions'
const KEEP = 50
/** At most one snapshot this often, and only when something changed. */
const EVERY_MS = 2 * 60 * 1000

let dbp: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

let lastJson = ''
let lastAt = 0
let pending: Patch | null = null
let timer = 0

async function write(p: Patch): Promise<void> {
  const json = JSON.stringify(p)
  if (json === lastJson) return
  lastJson = json
  lastAt = Date.now()
  try {
    await run('readwrite', (s) => s.add({ t: lastAt, patch: p }))
    const keys = await run('readonly', (s) => s.getAllKeys())
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) await run('readwrite', (s) => s.delete(k))
  } catch {
    /* storage blocked: no history, the rack still works */
  }
}

export const versions = {
  /** The rack changed: snapshot it now if it's been a while, or when it has. */
  touch(p: Patch): void {
    if (SCRATCH) return
    pending = p
    if (timer) return
    const wait = Math.max(0, lastAt + EVERY_MS - Date.now())
    timer = window.setTimeout(() => {
      timer = 0
      if (pending) void write(pending)
      pending = null
    }, wait)
  },
  /** Newest first. */
  async list(): Promise<Version[]> {
    if (SCRATCH) return []
    try {
      return (await run('readonly', (s) => s.getAll() as IDBRequest<Version[]>)).reverse()
    } catch {
      return []
    }
  },
}
