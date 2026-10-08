import { SPECS } from '../../modules'
import { hpOf } from '../../modules/size'
import { fits } from '../layout'
import { sanitize } from '../persist'
import { Kit } from '../starters/kit'
import type { Patch } from '../types'
import { EARLY_SONGS } from './early'
import { LATER_SONGS } from './later'
import type { Song } from './types'

export type { Song } from './types'

/** The Songs menu: whole tracks in the style of an era, oldest first. */
export const SONGS: Song[] = [...EARLY_SONGS, ...LATER_SONGS].sort((a, b) => a.year - b.year)

/** A song's rack (a whole patch, laid out for a 104 HP case). */
export function buildSong(song: Song): Patch {
  const k = new Kit(104)
  song.build(k)
  const p = k.build()
  return { ...p, rows: Math.max(p.rows, p.modules.reduce((r, m) => Math.max(r, m.row + 1), 0)) }
}

/** Dev check: every song builds, every cable and param is valid, nothing
 *  overlaps, and something reaches the speakers. */
export function validateSongs(): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const s of SONGS) {
    if (ids.has(s.id)) errors.push(`song ${s.id}: duplicate id`)
    ids.add(s.id)
    const p = buildSong(s)
    const clean = sanitize(p)
    if (!clean) errors.push(`song ${s.id}: invalid patch`)
    else if (clean.cables.length !== p.cables.length) errors.push(`song ${s.id}: ${p.cables.length - clean.cables.length} invalid cable(s)`)
    if (!p.modules.some((m) => m.type === 'output')) errors.push(`song ${s.id}: nothing goes to the speakers`)
    const fed = new Set<string>()
    for (const c of p.cables) {
      const to = `${c.to.mod}.${c.to.jack}`
      if (fed.has(to)) errors.push(`song ${s.id}: two cables into ${to}`)
      fed.add(to)
    }
    for (const m of p.modules) {
      if (!fits(p, m.row, m.hp, hpOf(m), m.id)) errors.push(`song ${s.id}: ${m.type} overlaps or overflows`)
      for (const key of Object.keys(m.params)) if (!SPECS[m.type].params.some((ps) => ps.id === key)) errors.push(`song ${s.id}: ${m.type} has no param ${key}`)
    }
  }
  return errors
}
