import { SPECS } from '../modules'
import { makeModule } from '../patch/factory'
import { findSlot } from '../patch/layout'
import type { Patch } from '../patch/types'
import { rackMatches } from './continuity'
import { lockId, withLock } from '../modules/specs/lockstepDefs'
import { COURSES } from './lessons/courses'
import type { Action, Lesson, Target } from './types'

/** Dev-time check of the course: play every lesson's steps on its starting
 *  rack (adding modules where the library would put them), and check every
 *  module type, jack and knob a step names exists, and that each lesson ends
 *  with the rack the next one starts from. */
export function validateCourses(): string[] {
  return COURSES.flatMap((c) => validateLessons(c.lessons, c.continuous))
}

export function validateLessons(lessons: Lesson[], continuous = true): string[] {
  const errors: string[] = []
  lessons.forEach((lesson, n) => {
    const start = lesson.build()
    const patch: Patch = structuredClone(start.patch)
    const mods = { ...start.mods }
    const where = (i: number) => `${lesson.id} step ${i + 1}`
    const spec = (name: string) => SPECS[patch.modules.find((m) => m.id === mods[name])?.type ?? '']
    const hasJack = (name: string, jack: string, dir: 'in' | 'out') => !!spec(name)?.[dir === 'in' ? 'inputs' : 'outputs'].some((j) => j.id === jack)
    const checkTarget = (t: Target | undefined, i: number) => {
      if (!t || 'ui' in t) return
      if ('lib' in t) {
        if (!SPECS[t.lib]) errors.push(`${where(i)}: no module type ${t.lib}`)
      } else if ('surface' in t) {
        if (!spec(t.mod)?.controls.some((c) => c.kind === 'surface')) errors.push(`${where(i)}: ${t.mod} has no surface`)
      } else if ('param' in t) {
        if (!spec(t.mod)?.params.some((p) => p.id === t.param)) errors.push(`${where(i)}: no knob ${t.mod}.${t.param}`)
      } else if (!hasJack(t.mod, t.jack, t.dir)) errors.push(`${where(i)}: no jack ${t.mod}.${t.jack}`)
    }
    const apply = (a: Action, i: number) => {
      if (a.kind === 'add') {
        if (!SPECS[a.type]) return void errors.push(`${where(i)}: no module type ${a.type}`)
        let slot = findSlot(patch, SPECS[a.type].hp)
        if (!slot) {
          patch.rows++
          slot = { row: patch.rows - 1, hp: 0 }
        }
        const m = makeModule(a.type, slot.row, slot.hp)
        patch.modules.push(m)
        mods[a.as] = m.id
      } else if (a.kind === 'connect') {
        if (!hasJack(a.from[0], a.from[1], 'out')) errors.push(`${where(i)}: no output ${a.from.join('.')}`)
        if (!hasJack(a.to[0], a.to[1], 'in')) errors.push(`${where(i)}: no input ${a.to.join('.')}`)
        const to = { mod: mods[a.to[0]], jack: a.to[1] }
        patch.cables = patch.cables.filter((c) => !(c.to.mod === to.mod && c.to.jack === to.jack))
        patch.cables.push({ id: `v${patch.cables.length}_${i}`, from: { mod: mods[a.from[0]], jack: a.from[1] }, to, color: '#fff' })
      } else if (a.kind === 'touch') {
        if (!spec(a.mod)?.controls.some((c) => c.kind === 'surface')) errors.push(`${where(i)}: ${a.mod} has no surface to play`)
      } else if (a.kind === 'disconnect') {
        if (!hasJack(a.to[0], a.to[1], 'in')) errors.push(`${where(i)}: no input ${a.to.join('.')}`)
        const to = mods[a.to[0]]
        if (!patch.cables.some((c) => c.to.mod === to && c.to.jack === a.to[1])) errors.push(`${where(i)}: nothing patched into ${a.to.join('.')} to pull out`)
        patch.cables = patch.cables.filter((c) => !(c.to.mod === to && c.to.jack === a.to[1]))
      } else if (a.kind === 'lock') {
        const m = patch.modules.find((x) => x.id === mods[a.mod])
        const id = lockId(a.track, a.step, a.page)
        if (!m || !SPECS[m.type].params.some((p) => p.id === id)) errors.push(`${where(i)}: no lock ${a.mod}.${id}`)
        else m.params[id] = withLock(m.params[id] ?? 0, a.knob, a.value)
      } else if (a.kind === 'step') {
        const m = patch.modules.find((x) => x.id === mods[a.mod])
        if (!m || !SPECS[m.type].params.some((p) => p.id === a.param)) errors.push(`${where(i)}: no step row ${a.mod}.${a.param}`)
        else {
          const v = Math.round(m.params[a.param] ?? 0)
          if (((v >>> a.bit) & 1) === (a.on ? 1 : 0)) errors.push(`${where(i)}: step ${a.bit + 1} of ${a.param} is already ${a.on ? 'on' : 'off'}`)
          m.params[a.param] = a.on ? v | (1 << a.bit) : v & ~(1 << a.bit)
        }
      } else if (a.kind === 'set') {
        const m = patch.modules.find((x) => x.id === mods[a.mod])
        if (!m || !SPECS[m.type].params.some((p) => p.id === a.param)) errors.push(`${where(i)}: no knob ${a.mod}.${a.param}`)
        else m.params[a.param] = a.value
      }
    }
    lesson.steps.forEach((s, i) => {
      checkTarget(s.target, i)
      if (s.action) apply(s.action, i)
      for (const t of s.then ?? []) apply(t, i)
    })
    const next = continuous ? lessons[n + 1] : undefined
    if (next && !rackMatches(patch, mods, next.build())) errors.push(`${lesson.id}: doesn't end with the rack “${next.id}” starts from`)
  })
  return errors
}
