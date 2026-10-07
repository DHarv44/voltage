import { catalogOf } from '../../modules/catalog'
import type { ModuleSpec } from '../../modules/types'

/** What a module can be found by, lower-cased, by how much a hit there counts. */
interface Fields {
  title: string
  name: string
  aka: string[]
  tags: string[]
  category: string
  tagline: string
}
const fieldsCache = new Map<string, Fields>()
function fields(s: ModuleSpec): Fields {
  let f = fieldsCache.get(s.type)
  if (!f) {
    const c = catalogOf(s.type)
    f = {
      title: s.title.toLowerCase(),
      name: s.name.toLowerCase(),
      aka: (c.aka ?? []).map((a) => a.toLowerCase()),
      tags: c.tags.map((t) => t.toLowerCase()),
      category: s.category.toLowerCase(),
      tagline: s.tagline.toLowerCase(),
    }
    fieldsCache.set(s.type, f)
  }
  return f
}

/** Ignore hyphens, dots and the like, so "tr16" finds TR-16 and "sh" S&H. */
const squash = (s: string) => s.replace(/[^a-z0-9]+/g, '')

/** How well one search word fits a module (0 = not at all). */
function wordScore(f: Fields, w: string): number {
  const sw = squash(w)
  const title = squash(f.title)
  if (title === sw) return 100
  if (title.startsWith(sw)) return 60
  if (f.aka.some((a) => a === w || squash(a) === sw)) return 50
  if (f.tags.includes(w)) return 40
  if (f.title.includes(w) || title.includes(sw)) return 35
  if (f.category.includes(w)) return 32
  if (f.aka.some((a) => a.includes(w))) return 30
  if (f.name.includes(w)) return 25
  if (f.tags.some((t) => t.startsWith(w))) return 15
  if (f.tagline.includes(w)) return 8
  return 0
}

/** Modules matching every word of `query` and carrying every tag in `tags`,
 *  best first (ties keep library order). */
export function searchModules(specs: ModuleSpec[], query: string, tags: string[]): ModuleSpec[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const scored: { s: ModuleSpec; score: number; i: number }[] = []
  specs.forEach((s, i) => {
    const f = fields(s)
    if (tags.some((t) => !f.tags.includes(t))) return
    let score = 0
    for (const w of words) {
      const ws = wordScore(f, w)
      if (ws === 0) return
      score += ws
    }
    scored.push({ s, score, i })
  })
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.s)
}
