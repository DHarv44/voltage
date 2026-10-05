import { SPECS } from '../../modules'
import { CABLE_COLORS, makeModule, uid } from '../../patch/factory'
import { findSlot } from '../../patch/layout'
import type { Patch } from '../../patch/types'

/** The fundamentals are one continuous course: each lesson starts with the
 *  rack the previous one ended with. These rebuild those racks for anyone
 *  opening a lesson directly, placing modules the way adding them by hand
 *  does, under the same names the lessons use. */
class Stage {
  patch: Patch = { rows: 1, modules: [], cables: [] }
  mods: Record<string, string> = {}

  add(name: string, type: string, params: Record<string, number> = {}): this {
    let slot = findSlot(this.patch, SPECS[type].hp)
    if (!slot) {
      this.patch.rows++
      slot = { row: this.patch.rows - 1, hp: 0 }
    }
    const m = makeModule(type, slot.row, slot.hp)
    Object.assign(m.params, params)
    this.patch.modules.push(m)
    this.mods[name] = m.id
    return this
  }

  set(name: string, params: Record<string, number>): this {
    const m = this.patch.modules.find((x) => x.id === this.mods[name])
    if (m) Object.assign(m.params, params)
    return this
  }

  /** Patch a cable (replacing whatever was in that input, as in the rack). */
  wire(from: [string, string], to: [string, string]): this {
    const mod = this.mods[to[0]]
    const cables = this.patch.cables.filter((c) => !(c.to.mod === mod && c.to.jack === to[1]))
    cables.push({ id: uid('c'), from: { mod: this.mods[from[0]], jack: from[1] }, to: { mod, jack: to[1] }, color: CABLE_COLORS[cables.length % CABLE_COLORS.length] })
    this.patch.cables = cables
    return this
  }
}

export interface Rack {
  patch: Patch
  mods: Record<string, string>
}

const done = (s: Stage): Rack => ({ patch: s.patch, mods: s.mods })

/** Lesson 1's end: VCO → MULT → OUT and SCOPE. */
const firstSound = () =>
  new Stage()
    .add('vco', 'vco')
    .add('out', 'output', { vol: 0.3 })
    .add('scope', 'scope')
    .add('mult', 'mult')
    .wire(['mult', 'a1'], ['out', 'l'])
    .wire(['mult', 'a2'], ['scope', 'ch1'])
    .wire(['vco', 'sin'], ['mult', 'a'])

/** Lesson 2's end: the saw through a resonant low-pass. */
const filters = () =>
  firstSound()
    .add('vcf', 'vcf', { cutoff: 250, res: 0.85 })
    .set('vco', { coarse: -1 })
    .wire(['vcf', 'lp4'], ['mult', 'a'])
    .wire(['vco', 'saw'], ['vcf', 'in'])

/** Lesson 3's end: played from the keyboard, VCA + envelope plucks. */
const envelopes = () =>
  filters()
    .set('vcf', { res: 0.15, cutoff: 1200 })
    .add('midi', 'midi')
    .wire(['midi', 'pitch'], ['vco', 'voct'])
    .add('vca', 'vca')
    .wire(['vca', 'out'], ['mult', 'a'])
    .wire(['vcf', 'lp4'], ['vca', 'in'])
    .add('adsr', 'adsr', { a: 0.002, s: 0, r: 2 })
    .wire(['midi', 'gate'], ['adsr', 'gate'])
    .wire(['adsr', 'env'], ['vca', 'cv'])

export const emptyRack = (): Rack => done(new Stage())
export const afterFirstSound = (): Rack => done(firstSound())
export const afterFilters = (): Rack => done(filters())
export const afterEnvelopes = (): Rack => done(envelopes())
