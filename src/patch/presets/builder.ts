import { CABLE_COLORS, makeModule, uid } from '../factory'
import type { Cable, ModuleInst, MorphSnapshot, Patch } from '../types'

/** Tiny DSL for writing preset racks: place modules, wire jacks, build. */
export class RackBuilder {
  private modules: ModuleInst[] = []
  private cables: Cable[] = []
  private rows = 1

  /** Mount a module at (row, hp) with param overrides; returns its id. */
  add(type: string, row: number, hp: number, params: Record<string, number> = {}): string {
    const m = makeModule(type, row, hp)
    Object.assign(m.params, params)
    this.modules.push(m)
    this.rows = Math.max(this.rows, row + 1)
    return m.id
  }

  /** Patch an output jack to an input jack. */
  wire(from: string, fromJack: string, to: string, toJack: string): void {
    this.cables.push({
      id: uid('c'),
      from: { mod: from, jack: fromJack },
      to: { mod: to, jack: toJack },
      color: CABLE_COLORS[this.cables.length % CABLE_COLORS.length],
    })
  }

  /** Store a snapshot in one of a module's slots (XY corners, scenes, macro
   *  ranges, MOTION lane targets). */
  setMorph(id: string, slot: number, snap: MorphSnapshot): void {
    const m = this.modules.find((x) => x.id === id)
    if (!m) return
    const morph = [...(m.morph ?? [])]
    while (morph.length <= slot) morph.push(null)
    morph[slot] = snap
    m.morph = morph
  }

  build(minRows = 2): Patch {
    return { rows: Math.max(minRows, this.rows), modules: this.modules, cables: this.cables }
  }
}

/** Semitones → volts (1V/oct). */
export const st = (semis: number) => semis / 12
