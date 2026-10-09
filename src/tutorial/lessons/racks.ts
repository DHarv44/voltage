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

/** Lesson 4's end: a held-open drone, an LFO on the filter (wah) and the pitch (vibrato). */
const modulation = () =>
  envelopes()
    .set('vca', { gain: 0.8 })
    .set('vcf', { res: 0.5, cv: 0.7 })
    .add('lfo', 'lfo', { rate: 0.3 })
    .wire(['lfo', 'tri'], ['vcf', 'cv'])
    .wire(['lfo', 'tri'], ['vco', 'fm'])
    .set('vco', { fm: 0.06 })

/** Lesson 5's end: CLOCK and SEQ-8 play the voice. */
const sequencing = () =>
  modulation()
    .set('vca', { gain: 0 })
    .add('clock', 'clock', { bpm: 140 })
    .add('seq', 'seq8', { s4: 0.6667, g6: 0, len: 6 })
    .wire(['clock', 'x2'], ['seq', 'clk'])
    .wire(['seq', 'gate'], ['adsr', 'gate'])
    .wire(['seq', 'cv'], ['vco', 'voct'])

/** Lesson 6's end: kick and hats on the same clock, all through a mixer. */
const drums = () =>
  sequencing()
    .add('kick', 'kick', { decay: 0.3 })
    .wire(['clock', 'x1'], ['kick', 'trig'])
    .add('mix', 'mixer', { l3: 0.4 })
    .wire(['vca', 'out'], ['mix', 'in1'])
    .wire(['mix', 'out'], ['mult', 'a'])
    .wire(['kick', 'out'], ['mix', 'in2'])
    .add('hats', 'hats')
    .wire(['clock', 'x4'], ['hats', 'ch'])
    .wire(['hats', 'mix'], ['mix', 'in3'])

export const emptyRack = (): Rack => done(new Stage())
/** Where the groovebox lesson ends up: LOCKSTEP into OUT, stopped. */
export const lockstepRack = (): Rack =>
  done(new Stage().add('out', 'output', { vol: 0.3 }).add('ls', 'lockstep').wire(['ls', 'l'], ['out', 'l']).wire(['ls', 'r'], ['out', 'r']))
export const afterFirstSound = (): Rack => done(firstSound())
export const afterFilters = (): Rack => done(filters())
export const afterEnvelopes = (): Rack => done(envelopes())
export const afterModulation = (): Rack => done(modulation())
export const afterSequencing = (): Rack => done(sequencing())
export const afterDrums = (): Rack => done(drums())
