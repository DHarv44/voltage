import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** An error the client sees as a status and a plain sentence. */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function json(res: ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(s)
}

/** The whole request body, refusing anything over `limit` bytes. */
export function body(req: IncomingMessage, limit: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0)
    if (declared > limit) return reject(new HttpError(413, `Too big: the limit is ${Math.round(limit / 1e6)} MB.`))
    const chunks: Buffer[] = []
    let n = 0
    req.on('data', (c: Buffer) => {
      n += c.length
      if (n > limit) {
        reject(new HttpError(413, `Too big: the limit is ${Math.round(limit / 1e6)} MB.`))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
    req.on('error', reject)
  })
}

export async function jsonBody<T>(req: IncomingMessage, limit = 16_000): Promise<T> {
  try {
    return JSON.parse(new TextDecoder().decode(await body(req, limit))) as T
  } catch (e) {
    throw e instanceof HttpError ? e : new HttpError(400, 'That wasn’t valid JSON.')
  }
}

/** The caller's address (Railway's proxy puts the real one first in X-Forwarded-For). */
export function ip(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for']
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim()
  return first || req.socket.remoteAddress || '?'
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** Constant-time comparison, so a key can't be guessed letter by letter. */
export function same(a: string, b: string): boolean {
  const x = Buffer.from(sha256(a))
  const y = Buffer.from(sha256(b))
  return timingSafeEqual(x, y)
}

/** A browser's owner key, as its stored hash (null if missing or malformed). */
export function ownerOf(req: IncomingMessage): string | null {
  const k = req.headers['x-owner-key']
  const key = Array.isArray(k) ? k[0] : k
  return key && /^[A-Za-z0-9_-]{32,128}$/.test(key) ? sha256(key) : null
}

/** So many actions per window per address (in memory: a restart forgets). */
export class Limiter {
  private readonly hits = new Map<string, number[]>()
  private readonly max: number
  private readonly windowMs: number
  constructor(max: number, windowMs: number) {
    this.max = max
    this.windowMs = windowMs
  }
  check(key: string): void {
    const now = Date.now()
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs)
    if (list.length >= this.max) throw new HttpError(429, 'Slow down a little: too many requests. Try again in a while.')
    list.push(now)
    this.hits.set(key, list)
    if (this.hits.size > 50_000) this.hits.clear() // never grows without bound
  }
}
