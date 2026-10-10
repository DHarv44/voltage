import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/** Who can open a patch: only its owner, anyone with the link, or listed in
 *  the gallery too (once an admin approves it). */
export type Visibility = 'private' | 'unlisted' | 'public'
/** A public patch's place in the gallery queue. */
export type Status = 'none' | 'pending' | 'approved' | 'rejected'

export interface Meta {
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
}

const META = 'id, title, note, visibility, status, size, modules, created, updated, opens, reports'

/** The patch store: one SQLite file on the volume (DATA_DIR). Bundles (the
 *  gzipped .voltage bytes) live in the row; owners are SHA-256 hashes of
 *  their browser's owner key, never the key itself. */
export class Store {
  private readonly db: DatabaseSync

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true })
    this.db = new DatabaseSync(join(dir, 'voltage.db'))
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS patches (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        visibility TEXT NOT NULL DEFAULT 'unlisted',
        status TEXT NOT NULL DEFAULT 'none',
        data BLOB NOT NULL,
        size INTEGER NOT NULL,
        modules INTEGER NOT NULL,
        created INTEGER NOT NULL,
        updated INTEGER NOT NULL,
        opened INTEGER NOT NULL,
        opens INTEGER NOT NULL DEFAULT 0,
        reports INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS patches_owner ON patches(owner);
      CREATE INDEX IF NOT EXISTS patches_gallery ON patches(status, visibility, created);
      CREATE TABLE IF NOT EXISTS reports (
        n INTEGER PRIMARY KEY AUTOINCREMENT,
        patch TEXT NOT NULL,
        reason TEXT NOT NULL,
        at INTEGER NOT NULL
      );
    `)
  }

  insert(r: { id: string; owner: string; title: string; note: string; visibility: Visibility; data: Uint8Array; modules: number }): void {
    const now = Date.now()
    this.db
      .prepare('INSERT INTO patches (id, owner, title, note, visibility, status, data, size, modules, created, updated, opened) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(r.id, r.owner, r.title, r.note, r.visibility, r.visibility === 'public' ? 'pending' : 'none', r.data, r.data.byteLength, r.modules, now, now, now)
  }

  /** Replace a patch's contents (a public one goes back for approval). */
  replace(id: string, r: { title: string; note: string; visibility: Visibility; data: Uint8Array; modules: number }): void {
    this.db
      .prepare('UPDATE patches SET title = ?, note = ?, visibility = ?, status = ?, data = ?, size = ?, modules = ?, updated = ? WHERE id = ?')
      .run(r.title, r.note, r.visibility, r.visibility === 'public' ? 'pending' : 'none', r.data, r.data.byteLength, r.modules, Date.now(), id)
  }

  /** Change the title, note or visibility only. */
  describe(id: string, title: string, note: string, visibility: Visibility, wasPublic: boolean, status: Status): void {
    const next: Status = visibility !== 'public' ? 'none' : wasPublic && status !== 'rejected' ? status : 'pending'
    this.db.prepare('UPDATE patches SET title = ?, note = ?, visibility = ?, status = ?, updated = ? WHERE id = ?').run(title, note, visibility, next, Date.now(), id)
  }

  owner(id: string): { owner: string; visibility: Visibility; status: Status } | undefined {
    return this.db.prepare('SELECT owner, visibility, status FROM patches WHERE id = ?').get(id) as { owner: string; visibility: Visibility; status: Status } | undefined
  }

  meta(id: string): Meta | undefined {
    return this.db.prepare(`SELECT ${META} FROM patches WHERE id = ?`).get(id) as Meta | undefined
  }

  /** The bundle bytes; counts as an open. */
  open(id: string): Uint8Array | undefined {
    const row = this.db.prepare('SELECT data FROM patches WHERE id = ?').get(id) as { data: Uint8Array } | undefined
    if (row) this.db.prepare('UPDATE patches SET opens = opens + 1, opened = ? WHERE id = ?').run(Date.now(), id)
    return row?.data
  }

  mine(owner: string): Meta[] {
    return this.db.prepare(`SELECT ${META} FROM patches WHERE owner = ? ORDER BY updated DESC`).all(owner) as unknown as Meta[]
  }

  gallery(q: string, sort: 'new' | 'top', offset: number, limit: number): Meta[] {
    const like = `%${q.replace(/[%_]/g, '')}%`
    return this.db
      .prepare(`SELECT ${META} FROM patches WHERE visibility = 'public' AND status = 'approved' AND (title LIKE ? OR note LIKE ?) ORDER BY ${sort === 'top' ? 'opens DESC, created DESC' : 'created DESC'} LIMIT ? OFFSET ?`)
      .all(like, like, limit, offset) as unknown as Meta[]
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM patches WHERE id = ?').run(id)
    this.db.prepare('DELETE FROM reports WHERE patch = ?').run(id)
  }

  /** Move every patch of one owner to another (a key brought from another device). */
  reassign(from: string, to: string): number {
    return Number(this.db.prepare('UPDATE patches SET owner = ? WHERE owner = ?').run(to, from).changes)
  }

  report(id: string, reason: string): void {
    this.db.prepare('INSERT INTO reports (patch, reason, at) VALUES (?, ?, ?)').run(id, reason, Date.now())
    this.db.prepare('UPDATE patches SET reports = reports + 1 WHERE id = ?').run(id)
  }

  setStatus(id: string, status: Status): void {
    this.db.prepare('UPDATE patches SET status = ? WHERE id = ?').run(status, id)
  }

  /** The admin's queue: public patches waiting, and anything reported. */
  queue(): Meta[] {
    return this.db.prepare(`SELECT ${META} FROM patches WHERE (visibility = 'public' AND status = 'pending') OR reports > 0 ORDER BY reports DESC, updated ASC LIMIT 200`).all() as unknown as Meta[]
  }

  reasons(id: string): { reason: string; at: number }[] {
    return this.db.prepare('SELECT reason, at FROM reports WHERE patch = ? ORDER BY at DESC LIMIT 20').all(id) as unknown as { reason: string; at: number }[]
  }

  /** Links nobody has opened in `days` go (gallery patches stay). */
  sweep(days: number): number {
    const before = Date.now() - days * 86_400_000
    return Number(this.db.prepare("DELETE FROM patches WHERE opened < ? AND NOT (visibility = 'public' AND status = 'approved')").run(before).changes)
  }

  stats(): { patches: number; bytes: number } {
    return this.db.prepare('SELECT COUNT(*) AS patches, COALESCE(SUM(size), 0) AS bytes FROM patches').get() as unknown as { patches: number; bytes: number }
  }
}
