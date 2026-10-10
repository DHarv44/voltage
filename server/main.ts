import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { api } from './api.ts'
import { Store } from './db.ts'
import { HttpError, json } from './http.ts'

/** VOLTAGE's server: the built app (dist/) plus the cloud API. Settings come
 *  from the environment (Railway → Variables):
 *  PORT       given by Railway
 *  DATA_DIR   where the SQLite file lives: mount a volume there (default ./data)
 *  ADMIN_KEY  a long random string; the admin page asks for it (no key: no admin)
 *  DIST       the built app (default ./dist) */
const PORT = Number(process.env.PORT) || 5205
const DATA_DIR = resolve(process.env.DATA_DIR || 'data')
const DIST = resolve(process.env.DIST || 'dist')
const ADMIN_KEY = process.env.ADMIN_KEY || ''
/** Links nobody opens for this long are cleared away (gallery ones stay). */
const EXPIRE_DAYS = 365

const store = new Store(DATA_DIR)
const sweep = () => console.log(`swept ${store.sweep(EXPIRE_DAYS)} unopened racks`)
sweep()
setInterval(sweep, 86_400_000).unref()

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
}

/** A file from dist/, or index.html for app routes (/, /p/abc12345, …). */
function serveStatic(path: string, res: ServerResponse): void {
  const file = normalize(join(DIST, decodeURIComponent(path)))
  const inside = file.startsWith(DIST)
  const found = inside && existsSync(file) && statSync(file).isFile()
  const target = found ? file : join(DIST, 'index.html')
  if (!existsSync(target)) {
    res.writeHead(503, { 'Content-Type': 'text/plain' })
    return void res.end('The app isn’t built yet (npm run build).')
  }
  // hashed assets never change; the page itself always revalidates
  const immutable = found && path.startsWith('/assets/')
  res.writeHead(200, {
    'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  createReadStream(target).pipe(res)
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://local')
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url, store, ADMIN_KEY).catch((e: unknown) => {
      const status = e instanceof HttpError ? e.status : 500
      if (status === 500) console.error(e)
      if (!res.headersSent) json(res, status, { error: e instanceof HttpError ? e.message : 'Something went wrong on the server.' })
    })
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    return void res.end()
  }
  serveStatic(url.pathname, res)
}).listen(PORT, () => console.log(`VOLTAGE on :${PORT} · data in ${DATA_DIR}${ADMIN_KEY ? '' : ' · no ADMIN_KEY: admin page off'}`))
