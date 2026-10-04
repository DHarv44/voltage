import { CABLE_COLORS, makeModule, uid } from '../factory'
import type { Cable, ModuleInst, Patch } from '../types'

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

  build(minRows = 2): Patch {
    return { rows: Math.max(minRows, this.rows), modules: this.modules, cables: this.cables }
  }
}

/** Semitones → volts (1V/oct). */
export const st = (semis: number) => semis / 12
