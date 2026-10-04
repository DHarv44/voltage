/** IndexedDB store for module audio (LOOP slots, SAMPLE buffers), keyed
 *  "<module id>/<slot>". Too big for localStorage; stays in this browser. */

const DB = 'voltage-audio'
const STORE = 'buffers'

export interface StoredBuffer {
  rate: number
  data: Float32Array
}

let dbp: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const bufferStore = {
  key: (id: string, slot: number) => `${id}/${slot}`,
  async get(id: string, slot: number): Promise<StoredBuffer | undefined> {
    try {
      return await tx('readonly', (s) => s.get(this.key(id, slot)) as IDBRequest<StoredBuffer | undefined>)
    } catch {
      return undefined
    }
  },
  async put(id: string, slot: number, b: StoredBuffer): Promise<void> {
    try {
      await tx('readwrite', (s) => s.put(b, this.key(id, slot)))
    } catch {
      /* storage blocked/full: audio just isn't kept */
    }
  },
  async remove(id: string, slot: number): Promise<void> {
    try {
      await tx('readwrite', (s) => s.delete(this.key(id, slot)))
    } catch {
      /* ignore */
    }
  },
}
