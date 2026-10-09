import { engine } from '../audio/engine'
import { SPECS } from '../modules'
import { fromNorm, toNorm } from '../modules/params'
import { actions, patchStore } from '../patch/store'
import { rackMatches } from './continuity'
import { COURSES, courseOf } from './lessons/courses'
import type { Patch } from '../patch/types'
import { settings } from '../ui/settings'
import { lockstepSel } from '../ui/surfaces/lockstep/layout'
import { lockId, lockValue, withLock } from '../modules/specs/lockstepDefs'

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
import type { Action, Lesson, Step, Target, TutorialMode } from './types'

export const LESSONS: Lesson[] = COURSES.flatMap((c) => c.lessons)

export interface TutorialState {
  lesson: Lesson | null
  mode: TutorialMode
  index: number
  /** The current step's task has been done (by you or by the tutorial). */
  done: boolean
  /** Lesson module names → module ids in this rack. */
  mods: Record<string, string>
  /** Said on a lesson's first step when the tutorial had to set up the rack. */
  notice?: string
  /** Guided: the knob's set, now play a note to hear what it did. */
  playPrompt?: boolean
}

type Fn = () => void
const URL_KEY = 'learn'

/** Runs a lesson. Lessons live in a `?scratch` rack, so your own patch is never
 *  touched: start() reloads the page into the lesson, exit() reloads back. */
class TutorialRunner {
  state: TutorialState = { lesson: null, mode: 'walkthrough', index: 0, done: false, mods: {} }
  private subs = new Set<Fn>()
  /** Where a "set" step's knob started (to tell which way you're turning it). */
  private from = 0
  private playTimers: number[] = []

  subscribe(fn: Fn): () => void {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  private emit(): void {
    this.state = { ...this.state }
    this.subs.forEach((f) => f())
  }

  /** Open a lesson (navigates to a scratch rack with the lesson in the URL). */
  open(id: string, mode: TutorialMode): void {
    location.href = `${location.pathname}?scratch&${URL_KEY}=${encodeURIComponent(id)}&mode=${mode}`
  }

  /** Back to your own rack. */
  exit(): void {
    location.href = location.pathname
  }

  /** End the lesson but keep the rack you built to play with (still a
   *  scratch rack: your saved patch is never touched). */
  finish(): void {
    this.state = { ...this.state, lesson: null, index: 0, done: false, playPrompt: false, notice: undefined }
    history.replaceState(null, '', `${location.pathname}?scratch`)
    this.emit()
  }

  /** Called once at startup: start the lesson named in the URL, if any. */
  boot(): void {
    const q = new URLSearchParams(location.search)
    const lesson = LESSONS.find((l) => l.id === q.get(URL_KEY))
    if (!lesson || !q.has('scratch')) return
    const { patch, mods } = lesson.build()
    actions.load(patch)
    this.state = { lesson, mode: q.get('mode') === 'guided' ? 'guided' : 'walkthrough', index: 0, done: false, mods }
    patchStore.subscribe(() => this.check())
    engine.subscribe(() => this.check())
    engine.midiListeners.add((ev) => {
      if (ev.kind === 'on') this.played = true
      if (ev.kind === 'on' || ev.kind === 'off') this.lastNote = performance.now()
      this.check()
    })
    // a surface played (strummed, waved over…) counts as playing too
    engine.uiListeners.add((id, ev) => {
      if (ev.kind !== 'surface') return
      if (ev.down) this.touched.add(`${id}:${ev.name}`).add(id)
      this.lastNote = performance.now()
      this.check()
    })
    window.addEventListener('pointerdown', () => (this.pointerDown = true), true)
    window.addEventListener('pointerup', () => (this.pointerDown = false), true)
    window.addEventListener('pointercancel', () => (this.pointerDown = false), true)
    void this.enter()
  }

  /** The lesson after this one in a continuous course, if any (lessons that
   *  stand alone have none). */
  get nextLesson(): Lesson | null {
    const lesson = this.state.lesson
    const course = lesson && courseOf(lesson)
    if (!lesson || !course?.continuous) return null
    return course.lessons[course.lessons.indexOf(lesson) + 1] ?? null
  }

  /** Carry straight on into the next lesson with the rack you built (or, if
   *  it's changed too much, the rack that lesson expects, and say so). */
  async continueNext(): Promise<void> {
    const next = this.nextLesson
    const prev = this.state.lesson
    if (!next || !prev) return
    this.stopPlaying()
    const expected = next.build()
    if (rackMatches(patchStore.get(), this.state.mods, expected)) this.state.notice = undefined
    else {
      actions.load(expected.patch)
      this.state.mods = expected.mods
      this.state.notice = `Your rack had changed from how “${prev.title}” ended, so I’ve set it up the way this lesson starts.`
    }
    this.state.lesson = next
    this.state.index = 0
    this.snapshots = []
    history.replaceState(null, '', `${location.pathname}?scratch&${URL_KEY}=${encodeURIComponent(next.id)}&mode=${this.state.mode}`)
    await this.enter()
  }

  private played = false
  /** Surfaces played during this step: module ids, and `id:gesture`. */
  private readonly touched = new Set<string>()

  get step(): Step | null {
    return this.state.lesson?.steps[this.state.index] ?? null
  }

  id(name: string): string {
    return this.state.mods[name] ?? name
  }

  private module(name: string) {
    return patchStore.get().modules.find((m) => m.id === this.id(name))
  }

  /** The rack as it was when each step began (for Redo step and Back). */
  private snapshots: Patch[] = []

  /** Every control a step points at. A connect step points at both ends,
   *  numbered 1 (drag from) and 2 (drop on). */
  targets(step: Step | null): { target: Target; label?: string }[] {
    if (!step) return []
    const a = step.action
    if (a?.kind === 'connect')
      return [
        { target: { mod: a.from[0], jack: a.from[1], dir: 'out' }, label: '1' },
        { target: { mod: a.to[0], jack: a.to[1], dir: 'in' }, label: '2' },
      ]
    if (a?.kind === 'add') return [{ target: { lib: a.type } }]
    if (a?.kind === 'disconnect') return [{ target: { mod: a.to[0], jack: a.to[1], dir: 'in' } }]
    if (a?.kind === 'touch') return [{ target: { mod: a.mod, surface: true } }]
    if (a?.kind === 'step') return [{ target: { mod: a.mod, param: a.param, bit: a.bit } }]
    if (a?.kind === 'lock') return [{ target: { mod: a.mod, surface: true } }]
    return step.target ? [{ target: step.target }] : []
  }

  /** Back to the lesson's starting rack, step one. */
  restart(): void {
    const lesson = this.state.lesson
    if (!lesson) return
    this.stopPlaying()
    // the rack this lesson began with (yours, if you continued into it)
    const first = this.snapshots[0]
    this.state.index = 0
    if (first) this.restore(first)
    else {
      const { patch, mods } = lesson.build()
      actions.load(patch)
      this.state.mods = mods
    }
    void this.enter()
  }

  /** Put the rack back to how it was when this step started. */
  redoStep(): void {
    const snap = this.snapshots[this.state.index]
    if (!snap) return
    this.stopPlaying()
    this.restore(snap)
    void this.enter()
  }

  private restore(snap: Patch): void {
    actions.load(structuredClone(snap))
    // forget names of modules that aren't in the restored rack
    const ids = new Set(patchStore.get().modules.map((m) => m.id))
    const mods = { ...this.state.mods }
    for (const [name, id] of Object.entries(mods)) if (!ids.has(id)) delete mods[name]
    this.state.mods = mods
  }

  private stopPlaying(): void {
    this.playTimers.forEach((t) => window.clearTimeout(t))
    this.playTimers = []
    engine.midi({ kind: 'panic' })
  }

  private begin(): void {
    this.snapshots[this.state.index] = structuredClone(patchStore.get())
    const a = this.step?.action
    if (a?.kind === 'set') this.from = this.module(a.mod)?.params[a.param] ?? 0
    this.played = false
    this.touched.clear()
    this.state.playPrompt = false
    this.state.done = !a || this.satisfied(a, true)
    this.emit()
  }

  /** Has this action's result happened? */
  private satisfied(a: Action, atStart = false): boolean {
    switch (a.kind) {
      case 'power':
        return engine.getStatus().power
      case 'connect':
        return patchStore
          .get()
          .cables.some((c) => c.from.mod === this.id(a.from[0]) && c.from.jack === a.from[1] && c.to.mod === this.id(a.to[0]) && c.to.jack === a.to[1])
      case 'disconnect':
        return !patchStore.get().cables.some((c) => c.to.mod === this.id(a.to[0]) && c.to.jack === a.to[1])
      case 'set': {
        if (atStart) return false
        const m = this.module(a.mod)
        const ps = m && SPECS[m.type].params.find((p) => p.id === a.param)
        if (!m || !ps) return false
        // most of the way from where it was toward the target, in knob travel
        const start = toNorm(ps, this.from)
        const goal = toNorm(ps, a.value)
        const now = toNorm(ps, m.params[a.param])
        return Math.abs(goal - start) < 1e-6 || (now - start) / (goal - start) >= 0.75
      }
      case 'play':
        return this.played
      case 'touch':
        return this.touched.has(a.name ? `${this.id(a.mod)}:${a.name}` : this.id(a.mod))
      case 'step': {
        const v = Math.round(this.module(a.mod)?.params[a.param] ?? 0)
        return ((v >>> a.bit) & 1) === (a.on ? 1 : 0)
      }
      case 'lock': {
        // that step holds a lock for that knob, near the value asked for
        const m = this.module(a.mod)
        const lv = m ? lockValue(m.params[lockId(a.track, a.step, a.page, Math.round(m.params.pat ?? 0))] ?? 0, a.knob) : -1
        return lv >= 0 && Math.abs(lv - a.value) <= 0.2
      }
      case 'add': {
        // whichever module of that type you added (click or drag) gets the name
        if (this.state.mods[a.as] && this.module(a.as)) return true
        if (atStart) return false
        const named = new Set(Object.values(this.state.mods))
        const m = patchStore.get().modules.find((x) => x.type === a.type && !named.has(x.id))
        if (m) this.state.mods = { ...this.state.mods, [a.as]: m.id }
        return !!m
      }
    }
  }

  /** Watch for the step being done. Guided mode then moves straight on (the
   *  prompt already said what to listen for), once your hand is off the knob. */
  private check(): void {
    const a = this.step?.action
    if (!a || this.state.done) return
    if (this.satisfied(a)) {
      this.state.done = true
      this.emit()
      void this.afterDone()
    }
  }

  private async afterDone(): Promise<void> {
    const index = this.state.index
    const guided = this.state.mode === 'guided'
    // Walkthrough plays any notes for you; guided asks you to play them.
    const then = this.step?.then ?? []
    for (const t of then) if (!guided || t.kind !== 'play') await this.perform(t)
    if (!guided) return
    while (this.pointerDown) await wait(50)
    if (then.some((t) => t.kind === 'play')) {
      this.played = false
      this.state.playPrompt = true
      this.emit()
      while (!this.played && this.state.index === index && this.state.playPrompt) await wait(100)
      if (this.state.index !== index) return
    }
    // let them (or Show me) finish playing, and the last note ring out
    const kind = this.step?.action?.kind
    if (this.state.playPrompt || kind === 'play' || kind === 'touch') while (performance.now() - this.lastNote < 2000) await wait(100)
    await wait(450)
    if (this.state.index === index && this.state.done) await this.next()
  }

  private pointerDown = false
  private lastNote = 0

  /** Do an action for the user (walkthrough, or guided "Show me"). Knob moves
   *  glide so you hear them happen. */
  async perform(a: Action): Promise<void> {
    switch (a.kind) {
      case 'power':
        await engine.setPower(true)
        return
      case 'add': {
        // Show where it comes from: open its section in the library, let the
        // glowing row (and the popover) sit there a moment, then add it.
        const cat = SPECS[a.type]?.category
        const { libOpen: open, libTags } = settings.get()
        if (cat && (!open.includes(cat) || libTags.length)) {
          settings.set({ libOpen: open.includes(cat) ? open : [...open, cat], libTags: [] }) // a tag filter would hide it
          await wait(700)
        }
        await wait(1100)
        const id = actions.addModule(a.type)
        if (id) this.state.mods = { ...this.state.mods, [a.as]: id }
        return
      }
      case 'connect':
        actions.connect({ mod: this.id(a.from[0]), jack: a.from[1], dir: 'out' }, { mod: this.id(a.to[0]), jack: a.to[1], dir: 'in' }, '#ffb347')
        return
      case 'disconnect':
        actions.removeCablesAt(this.id(a.to[0]), a.to[1])
        return
      case 'step': {
        const m = this.module(a.mod)
        if (!m) return
        const v = Math.round(m.params[a.param] ?? 0)
        actions.setParam(m.id, a.param, a.on ? v | (1 << a.bit) : v & ~(1 << a.bit))
        return
      }
      case 'lock': {
        // as a hand would: the track, the step picked, the page, then the knob
        const m = this.module(a.mod)
        if (!m) return
        actions.setParam(m.id, 'trk', a.track)
        lockstepSel.set(m.id, a.step)
        actions.setParam(m.id, 'page', a.page)
        await wait(600)
        const id = lockId(a.track, a.step, a.page, Math.round(m.params.pat ?? 0))
        actions.setParam(m.id, id, withLock(this.module(a.mod)?.params[id] ?? 0, a.knob, a.value))
        return
      }
      case 'set': {
        const m = this.module(a.mod)
        const ps = m && SPECS[m.type].params.find((p) => p.id === a.param)
        if (!m || !ps) return
        const start = toNorm(ps, m.params[a.param])
        const goal = toNorm(ps, a.value)
        const ms = 1600
        const t0 = performance.now()
        await new Promise<void>((resolve) => {
          const tick = () => {
            const t = Math.min(1, (performance.now() - t0) / ms)
            const e = t * t * (3 - 2 * t)
            actions.setParam(m.id, a.param, ps.stepped ? a.value : fromNorm(ps, start + (goal - start) * e))
            if (t < 1) requestAnimationFrame(tick)
            else resolve()
          }
          tick()
        })
        return
      }
      case 'touch': {
        // the demo gesture, on the module itself
        const id = this.id(a.mod)
        const end = Math.max(0, ...a.demo.map((d) => d.at))
        await new Promise<void>((resolve) => {
          for (const d of a.demo)
            this.playTimers.push(window.setTimeout(() => engine.ui(id, { kind: 'surface', name: d.name, x: d.x, y: d.y, down: d.down }), d.at * 1000))
          this.playTimers.push(window.setTimeout(resolve, end * 1000 + 50))
        })
        return
      }
      case 'play': {
        const spacing = (a.spacing ?? 0.45) * 1000
        const hold = (a.hold ?? 0.35) * 1000
        await new Promise<void>((resolve) => {
          a.notes.forEach((n, i) => {
            this.playTimers.push(window.setTimeout(() => engine.midi({ kind: 'on', note: 60 + n, vel: 100 }), i * spacing))
            this.playTimers.push(window.setTimeout(() => engine.midi({ kind: 'off', note: 60 + n }), i * spacing + hold))
          })
          this.playTimers.push(window.setTimeout(resolve, (a.notes.length - 1) * spacing + hold + 50))
        })
        return
      }
    }
  }

  /** Walkthrough: go to the next step and perform it. Guided: just move on. */
  async next(): Promise<void> {
    const lesson = this.state.lesson
    if (!lesson || this.state.index >= lesson.steps.length - 1) return
    this.state.index++
    await this.enter()
  }

  /** Back a step, with the rack as it was then, so the step can happen again. */
  async back(): Promise<void> {
    if (this.state.index <= 0) return
    this.stopPlaying()
    this.state.index--
    const snap = this.snapshots[this.state.index]
    if (snap) this.restore(snap)
    await this.enter(-1)
  }

  /** Arrive at a step. Walkthrough does it for you right away (inside the
   *  click, so POWER ON is allowed to start audio); guided waits for you. */
  private async enter(dir: 1 | -1 = 1): Promise<void> {
    // pass over steps that are already done (POWER ON when you've continued)
    const steps = this.state.lesson?.steps ?? []
    for (;;) {
      const s = this.step
      const i = this.state.index + dir
      if (!s?.skipIfDone || !s.action || i < 0 || i >= steps.length || !this.satisfied(s.action, true)) break
      this.state.index = i
    }
    if (this.state.index > 0) this.state.notice = undefined
    this.begin()
    const a = this.step?.action
    if (this.state.mode === 'walkthrough' && a && !this.state.done) {
      await this.perform(a)
      this.check()
    } else if (a && this.state.done) {
      void this.afterDone() // already done (guided has no Next to press)
    }
  }

  /** Guided "Show me": do the current task for them. */
  async showMe(): Promise<void> {
    if (this.state.playPrompt) {
      // waiting for you to play a note: play it for you instead
      for (const t of this.step?.then ?? []) if (t.kind === 'play') await this.perform(t)
      return
    }
    const a = this.step?.action
    if (a) await this.perform(a)
    this.check()
  }
}

export const tutorial = new TutorialRunner()
