import { engine } from '../audio/engine'
import { SPECS } from '../modules'
import { fromNorm, toNorm } from '../modules/params'
import { actions, patchStore } from '../patch/store'
import { FUNDAMENTALS } from './lessons/fundamentals'
import type { Patch } from '../patch/types'
import { settings } from '../ui/settings'

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
import type { Action, Lesson, Step, Target, TutorialMode } from './types'

export const LESSONS: Lesson[] = [...FUNDAMENTALS]

export interface TutorialState {
  lesson: Lesson | null
  mode: TutorialMode
  index: number
  /** The current step's task has been done (by you or by the tutorial). */
  done: boolean
  /** Lesson module names → module ids in this rack. */
  mods: Record<string, string>
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
      this.check()
    })
    this.begin()
  }

  private played = false

  get step(): Step | null {
    return this.state.lesson?.steps[this.state.index] ?? null
  }

  id(name: string): string {
    return this.state.mods[name] ?? name
  }

  private module(name: string) {
    return patchStore.get().modules.find((m) => m.id === this.id(name))
  }

  /** The rack as it was when this step began (for "Redo this step"). */
  private snapshot: Patch | null = null

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
    return step.target ? [{ target: step.target }] : []
  }

  /** Back to the lesson's starting rack, step one. */
  restart(): void {
    const lesson = this.state.lesson
    if (!lesson) return
    this.stopPlaying()
    const { patch, mods } = lesson.build()
    actions.load(patch)
    this.state.mods = mods
    this.state.index = 0
    this.begin()
  }

  /** Put the rack back to how it was when this step started. */
  redoStep(): void {
    if (!this.snapshot) return
    this.stopPlaying()
    actions.load(structuredClone(this.snapshot))
    // forget names of modules that aren't in the restored rack
    const ids = new Set(patchStore.get().modules.map((m) => m.id))
    for (const [name, id] of Object.entries(this.state.mods)) if (!ids.has(id)) delete this.state.mods[name]
    this.begin()
  }

  private stopPlaying(): void {
    this.playTimers.forEach((t) => window.clearTimeout(t))
    this.playTimers = []
    engine.midi({ kind: 'panic' })
  }

  private begin(): void {
    this.snapshot = structuredClone(patchStore.get())
    const a = this.step?.action
    if (a?.kind === 'set') this.from = this.module(a.mod)?.params[a.param] ?? 0
    this.played = false
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

  /** In guided mode, watch for the step being done; then celebrate and move on. */
  private check(): void {
    const a = this.step?.action
    if (!a || this.state.done) return
    if (this.satisfied(a)) {
      this.state.done = true
      this.emit()
      // No auto-advance: you get time to listen; Next pulses when you're ready.
      void this.runThen()
    }
  }

  private async runThen(): Promise<void> {
    for (const t of this.step?.then ?? []) await this.perform(t)
  }

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
        const open = settings.get().libOpen
        if (cat && !open.includes(cat)) {
          settings.set({ libOpen: [...open, cat] })
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
    this.begin()
    const a = this.step?.action
    if (this.state.mode === 'walkthrough' && a && !this.state.done) {
      await this.perform(a) // inside the click, so POWER ON is allowed to start audio
      this.check()
    }
  }

  back(): void {
    if (this.state.index <= 0) return
    this.state.index--
    this.begin()
  }

  /** Guided "Show me": do the current task for them. */
  async showMe(): Promise<void> {
    const a = this.step?.action
    if (a) await this.perform(a)
    this.check()
  }
}

export const tutorial = new TutorialRunner()
