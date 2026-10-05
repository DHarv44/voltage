import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { SPECS } from '../../modules'
import { fromNorm, toNorm } from '../../modules/params'
import { MACROS, SCENE_SLOTS, SCENEL } from '../../modules/specs/perform'
import type { ParamSpec } from '../../modules/types'
import { actions, patchStore } from '../../patch/store'
import type { MorphSnapshot } from '../../patch/types'
import { PX } from '../geometry'
import { captureSnapshot, CONTROLLERS, lerpSnapshots } from '../xy/morph'
import { RES, useFrame, type SurfaceProps } from './common'

const btnFont = (H: number, k = 0.3) => `600 ${Math.round(H * k)}px Bahnschrift, 'Arial Narrow', sans-serif`

/** Glide the rack from where it is to a snapshot over `secs` (0 = jump). */
function glideTo(target: MorphSnapshot, secs: number, key: string, stop: { cancel?: () => void }): void {
  stop.cancel?.()
  const from = captureSnapshot(patchStore.get())
  const t0 = performance.now()
  const step = () => {
    const t = secs <= 0 ? 1 : Math.min(1, (performance.now() - t0) / 1000 / secs)
    const eased = t * t * (3 - 2 * t)
    actions.setParams(lerpSnapshots(patchStore.get(), from, target, eased), key)
    if (t >= 1) stop.cancel = undefined
  }
  step()
  const timer = window.setInterval(() => {
    step()
    if (!stop.cancel) window.clearInterval(timer)
  }, 16)
  stop.cancel = () => window.clearInterval(timer)
}

/** SCENES: eight slots. */
export function Scenes({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = useRef(inst)
  live.current = inst
  const glide = useRef<{ cancel?: () => void }>({})
  const [current, setCurrent] = useState(-1)
  const cur = useRef(current)
  cur.current = current

  const recall = (i: number) => {
    const snap = live.current.morph?.[i]
    if (!snap) return
    setCurrent(i)
    glideTo(snap, live.current.params.time, `scene:${mod}`, glide.current)
  }

  // CV requests from the engine.
  useEffect(() => {
    let seen = -1
    return telemetry.subscribe(() => {
      const led = telemetry.leds[mod]
      if (!led || led[SCENEL.count] === seen) return
      const first = seen < 0
      seen = led[SCENEL.count]
      if (first) return
      let want = led[SCENEL.want]
      if (want === -2) {
        // NEXT: the next stored scene after the current one
        const stored = (live.current.morph ?? []).map((s, k) => (s ? k : -1)).filter((k) => k >= 0)
        want = stored.find((k) => k > cur.current) ?? stored[0] ?? -1
      }
      if (want >= 0) recall(want)
    })
  }, [mod])
  useEffect(() => () => glide.current.cancel?.(), [])

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const stored = live.current.morph ?? []
    const storing = live.current.params.store >= 0.5
    ctx.fillStyle = '#16202b'
    ctx.fillRect(0, 0, W, H)
    const bw = W / 2
    const bh = H / 4
    for (let i = 0; i < SCENE_SLOTS; i++) {
      const bx = (i % 2) * bw
      const by = Math.floor(i / 2) * bh
      ctx.fillStyle = i === cur.current ? '#7fc3ff' : stored[i] ? '#2f5f8a' : storing ? '#5a2a2a' : '#22303f'
      ctx.beginPath()
      ctx.roundRect(bx + 5, by + 5, bw - 10, bh - 10, 8)
      ctx.fill()
      ctx.fillStyle = i === cur.current ? '#0b1622' : '#e6ecf2'
      ctx.font = btnFont(bh, 0.38)
      ctx.textAlign = 'center'
      ctx.fillText(String(i + 1), bx + bw / 2, by + bh * 0.62)
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.min(3, Math.floor(((e.clientY - r.top) / r.height) * 4)) * 2 + ((e.clientX - r.left) / r.width >= 0.5 ? 1 : 0)
    const stored = live.current.morph?.[i]
    if (!stored || live.current.params.store >= 0.5) {
      actions.setMorphCorner(mod, i, captureSnapshot(patchStore.get()))
      setCurrent(i)
    } else recall(i)
  }
  const clear = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.min(3, Math.floor(((e.clientY - r.top) / r.height) * 4)) * 2 + ((e.clientX - r.left) / r.width >= 0.5 ? 1 : 0)
    actions.setMorphCorner(mod, i, null)
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }} onPointerDown={down} onContextMenu={clear} />
}

/** MACRO: the LEARN buttons, and the controller that applies the macros. */
export function Macro({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = useRef(inst)
  live.current = inst
  const learning = useRef<(MorphSnapshot | null)[]>(Array(MACROS).fill(null))
  const [, redraw] = useState(0)

  // Apply: each macro's value (knob + CV, from the engine) sweeps its learned range.
  useEffect(() => {
    const applied = new Float64Array(MACROS).fill(-1)
    const apply = () => {
      const led = telemetry.leds[mod]
      // read the store, not the last render: this runs before React re-renders
      const p = patchStore.get()
      const m = p.modules.find((x) => x.id === mod)
      if (!m) return
      const cables = p.cables
      for (let i = 0; i < MACROS; i++) {
        if (learning.current[i]) continue
        const from = m.morph?.[i * 2]
        const to = m.morph?.[i * 2 + 1]
        if (!from || !to) continue
        // knob from the patch; CV (when patched) from the engine
        const cv = led && cables.some((c) => c.to.mod === mod && c.to.jack === `cv${i + 1}`) ? led[i] : 0
        const v = Math.min(1, Math.max(0, m.params[`m${i + 1}`] + cv))
        if (Math.abs(v - applied[i]) < 0.002) continue
        applied[i] = v
        actions.setParams(lerpSnapshots(patchStore.get(), from, to, v), `macro:${mod}:${i}`)
      }
    }
    const a = telemetry.subscribe(apply)
    const b = patchStore.subscribe(apply)
    return () => {
      a()
      b()
    }
  }, [mod])

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#4a1612'
    ctx.fillRect(0, 0, W, H)
    const bw = W / MACROS
    for (let i = 0; i < MACROS; i++) {
      const on = !!learning.current[i]
      const has = !!live.current.morph?.[i * 2 + 1]
      ctx.fillStyle = on ? '#ffb347' : has ? '#8a3a2a' : '#2a1210'
      ctx.beginPath()
      ctx.roundRect(i * bw + 4, 4, bw - 8, H - 8, 6)
      ctx.fill()
      ctx.fillStyle = on ? '#2a1210' : '#f3e9dc'
      ctx.font = btnFont(H, 0.26)
      ctx.textAlign = 'center'
      ctx.fillText(on ? 'DONE' : 'LEARN', i * bw + bw / 2, H * 0.48)
      ctx.font = btnFont(H, 0.2)
      ctx.fillText(String(i + 1), i * bw + bw / 2, H * 0.8)
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.min(MACROS - 1, Math.floor(((e.clientX - r.left) / r.width) * MACROS))
    const start = learning.current[i]
    if (!start) learning.current[i] = captureSnapshot(patchStore.get())
    else {
      // Learned: only the knobs that moved between LEARN and DONE.
      const end = captureSnapshot(patchStore.get())
      const from: MorphSnapshot = {}
      const to: MorphSnapshot = {}
      for (const key of Object.keys(end)) {
        if (start[key] === undefined || Math.abs(end[key] - start[key]) < 1e-6) continue
        from[key] = start[key]
        to[key] = end[key]
      }
      actions.setMorphCorner(mod, i * 2, from)
      actions.setMorphCorner(mod, i * 2 + 1, to)
      actions.setParam(mod, `m${i + 1}`, 1)
      learning.current[i] = null
    }
    redraw((n) => n + 1)
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }} onPointerDown={down} />
}

/** Main volumes are never rolled. */
const PROTECTED = new Set(['vol', 'master'])

/** Nudge `count` random knobs by up to ±amount of their travel. */
function roll(count: number, amount: number): void {
  const p = patchStore.get()
  const pool: [string, string, number, ParamSpec][] = []
  for (const m of p.modules) {
    if (CONTROLLERS.has(m.type)) continue
    for (const ps of SPECS[m.type].params) if (!ps.stepped && !PROTECTED.has(ps.id)) pool.push([m.id, ps.id, m.params[ps.id], ps])
  }
  const updates: [string, string, number][] = []
  for (let k = 0; k < count && pool.length; k++) {
    const [id, param, v, ps] = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
    updates.push([id, param, fromNorm(ps, Math.min(1, Math.max(0, toNorm(ps, v) + (Math.random() * 2 - 1) * amount)))])
  }
  actions.setParams(updates, `accident:${Date.now()}`)
}

/** ACCIDENT: the ROLL button, EVOLVE drift and TRIG rolls. */
export function Accident({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = useRef(inst)
  live.current = inst
  const flash = useRef(0)

  const go = (count = live.current.params.count, amount = live.current.params.amount) => {
    roll(Math.round(count), amount)
    flash.current = 1
  }

  useEffect(() => {
    let seen = -1
    const unsub = telemetry.subscribe(() => {
      const c = telemetry.leds[mod]?.[0]
      if (c === undefined) return
      if (seen >= 0 && c !== seen) go()
      seen = c
    })
    // EVOLVE: every quarter second, maybe drift one knob a little
    const timer = window.setInterval(() => {
      const ev = live.current.params.evolve
      if (ev > 0 && Math.random() < ev * 0.25) go(1, live.current.params.amount * 0.4)
    }, 250)
    return () => {
      unsub()
      window.clearInterval(timer)
    }
  }, [mod])

  useFrame(ref, (_now, dt) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    flash.current = Math.max(0, flash.current - dt * 3)
    ctx.fillStyle = `rgb(${40 + flash.current * 200},${40 + flash.current * 120},${44})`
    ctx.beginPath()
    ctx.roundRect(4, 4, W - 8, H - 8, 10)
    ctx.fill()
    ctx.fillStyle = '#e8e4da'
    ctx.font = btnFont(H, 0.32)
    ctx.textAlign = 'center'
    ctx.fillText('🎲 ROLL', W / 2, H * 0.62)
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    go()
  }

  return <canvas ref={ref} className="surface-canvas" width={W} height={H} style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }} onPointerDown={down} />
}
