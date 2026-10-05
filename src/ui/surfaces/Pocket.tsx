import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { POCKET_SOUNDS, POCKET_STEPS, POCKETL } from '../../modules/specs/pocket'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { drawCanvasKnob, useCanvasKnobs, type CanvasKnob } from './canvasKnob'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

/** Regions as fractions of the surface. */
const LCD = { x: 0.05, y: 0.03, w: 0.9, h: 0.27 }
const KNOB_Y = 0.4
const KNOBS = [0.16, 0.39]
const FN = [
  { x: 0.64, name: 'PLAY' },
  { x: 0.86, name: 'WRITE' },
]
const GRID = { x: 0.05, y: 0.52, w: 0.9, h: 0.46 }

/** Pocket groovebox face: LCD, knobs A and B, PLAY/WRITE, and the 4×4 buttons. */
export function Pocket({ inst, spec, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params
  const [lockStep, setLockStep] = useState<number | null>(null)
  const lockRef = useRef(lockStep)
  lockRef.current = lockStep

  const knobParam = (k: number) => {
    const sel = Math.round(params.current.sel)
    const ab = k === 0 ? 'a' : 'b'
    return lockRef.current !== null ? `l${ab}${sel}_${lockRef.current}` : `${ab}${sel}`
  }

  // Knobs A and B: the selected sound's, or (with a step picked) that step's
  // lock. A lock not set yet shows, and starts from, the sound's own value.
  const knobs = (): CanvasKnob[] =>
    KNOBS.map((fx, k) => {
      // live from the store: gestures can arrive faster than React re-renders
      const p = patchStore.get().modules.find((m) => m.id === mod)?.params ?? params.current
      const ab = k === 0 ? 'a' : 'b'
      const sound = `${ab}${Math.round(p.sel)}`
      const id = knobParam(k)
      const locking = lockRef.current !== null
      const v = p[id] ?? 0.5
      const label = k === 0 ? 'A · PITCH' : 'B · DECAY'
      return {
        fx,
        fy: KNOB_Y,
        fr: 0.075,
        ps: locking ? { id, label, min: 0, max: 1, def: 0.5 } : (spec.params.find((s) => s.id === id) ?? { id, label, min: 0, max: 1, def: 0.5 }),
        value: locking && v < 0 ? (p[sound] ?? 0.5) : v,
        set: (nv: number) => actions.setParam(mod, id, nv),
        label: locking ? `${label} (step ${lockRef.current! + 1} lock)` : label,
        reset: locking ? () => actions.setParam(mod, id, -1) : undefined, // clear the lock
      }
    })
  const pressKnob = useCanvasKnobs(ref, knobs)

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = params.current
    const led = telemetry.leds[mod]
    const step = led?.[POCKETL.step] ?? -1
    const sel = Math.round(p.sel)
    const mask = p[`m${sel}`] ?? 0
    ctx.fillStyle = '#d8d0bd'
    ctx.fillRect(0, 0, W, H)

    // LCD: sound, BPM, step strip, and a little visualiser of the sounds.
    const lx = LCD.x * W
    const ly = LCD.y * H
    const lw = LCD.w * W
    const lh = LCD.h * H
    ctx.fillStyle = '#9fb08c'
    ctx.fillRect(lx, ly, lw, lh)
    ctx.fillStyle = '#26301e'
    ctx.font = `600 ${Math.round(lh * 0.2)}px Consolas, 'Courier New', monospace`
    ctx.textAlign = 'left'
    ctx.fillText(`${sel + 1} ${POCKET_SOUNDS[sel]}`, lx + lw * 0.04, ly + lh * 0.26)
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(p.tempo)}`, lx + lw * 0.96, ly + lh * 0.26)
    for (let i = 0; i < POCKET_STEPS; i++) {
      const sx = lx + lw * (0.04 + (0.92 * i) / POCKET_STEPS)
      const sw = (lw * 0.92) / POCKET_STEPS - 3
      ctx.fillStyle = i === step ? '#26301e' : mask & (1 << i) ? 'rgba(38,48,30,0.7)' : 'rgba(38,48,30,0.18)'
      ctx.fillRect(sx, ly + lh * 0.82, sw, lh * 0.1)
    }
    for (let s = 0; s < POCKET_SOUNDS.length; s++) {
      const v = led?.[POCKETL.hit0 + s] ?? 0
      const bx = lx + lw * (0.05 + s * 0.06)
      ctx.fillStyle = 'rgba(38,48,30,0.8)'
      ctx.fillRect(bx, ly + lh * 0.72 - v * lh * 0.36, lw * 0.035, v * lh * 0.36)
    }
    // the little dancer: bobs on the beat, arms up on kicks
    const kick = led?.[POCKETL.hit0] ?? 0
    const dx = lx + lw * 0.78
    const dy = ly + lh * 0.55 - kick * lh * 0.06
    ctx.fillStyle = '#26301e'
    ctx.fillRect(dx, dy, lw * 0.06, lh * 0.18)
    ctx.fillRect(dx + lw * 0.012, dy - lh * 0.12, lw * 0.036, lh * 0.1)
    const arm = kick > 0.4 ? -1 : 1
    ctx.fillRect(dx - lw * 0.03, dy + lh * (arm < 0 ? -0.06 : 0.04), lw * 0.03, lh * 0.04)
    ctx.fillRect(dx + lw * 0.06, dy + lh * (arm < 0 ? -0.06 : 0.04), lw * 0.03, lh * 0.04)
    if (lockRef.current !== null) {
      ctx.textAlign = 'left'
      ctx.font = `${Math.round(lh * 0.15)}px Consolas, 'Courier New', monospace`
      ctx.fillText(`LOCK ${lockRef.current + 1}`, lx + lw * 0.04, ly + lh * 0.5)
    }

    // Knobs A and B (a set lock shows red).
    for (const [k, knob] of knobs().entries()) {
      const locked = lockRef.current !== null && (p[knobParam(k)] ?? -1) >= 0
      drawCanvasKnob(ctx, knob, W, H, { body: locked ? '#c2402a' : '#2a2a2a', pointer: '#eee', ticks: '#4a4540' })
      ctx.fillStyle = '#2a2520'
      ctx.textAlign = 'center'
      ctx.font = `${Math.round(H * 0.035)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText(k === 0 ? 'A · PITCH' : 'B · DECAY', knob.fx * W, (knob.fy + knob.fr) * H + H * 0.05)
    }
    FN.forEach((f, k) => {
      const on = k === 0 ? p.run >= 0.5 : p.write >= 0.5
      ctx.fillStyle = on ? '#c2402a' : '#4a4540'
      ctx.beginPath()
      ctx.roundRect(f.x * W - W * 0.08, KNOB_Y * H - H * 0.045, W * 0.16, H * 0.09, 6)
      ctx.fill()
      ctx.fillStyle = '#f2eee6'
      ctx.font = `600 ${Math.round(H * 0.035)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText(f.name, f.x * W, KNOB_Y * H + H * 0.012)
    })

    // 4×4 buttons.
    const bw = (GRID.w * W) / 4
    const bh = (GRID.h * H) / 4
    for (let i = 0; i < 16; i++) {
      const bx = GRID.x * W + (i % 4) * bw
      const by = GRID.y * H + Math.floor(i / 4) * bh
      const write = p.write >= 0.5
      const on = write ? !!(mask & (1 << i)) : i === sel
      ctx.fillStyle = i === lockRef.current ? '#c2402a' : on ? '#3a3632' : '#efe9dc'
      ctx.beginPath()
      ctx.roundRect(bx + 4, by + 4, bw - 8, bh - 8, 6)
      ctx.fill()
      if (i === step) {
        ctx.strokeStyle = '#ff6a1a'
        ctx.lineWidth = 3
        ctx.stroke()
      }
      ctx.fillStyle = on || i === lockRef.current ? '#f2eee6' : '#3a3632'
      ctx.font = `${Math.round(bh * 0.28)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText(String(i + 1), bx + bw / 2, by + bh * 0.5)
      if (!write && i < 8) {
        ctx.font = `${Math.round(bh * 0.16)}px Bahnschrift, 'Arial Narrow', sans-serif`
        ctx.fillText(POCKET_SOUNDS[i], bx + bw / 2, by + bh * 0.75)
      }
    }
    void now
  })

  const region = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, r }
  }
  const gridIndex = (fx: number, fy: number) => {
    if (fy < GRID.y || fx < GRID.x || fx > GRID.x + GRID.w) return -1
    return Math.min(3, Math.floor(((fy - GRID.y) / GRID.h) * 4)) * 4 + Math.min(3, Math.floor(((fx - GRID.x) / GRID.w) * 4))
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pressKnob(e)) return // A/B knobs: left or middle drag
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const { fx, fy, r } = region(e)
    const p = params.current
    const sel = Math.round(p.sel)
    const i = gridIndex(fx, fy)
    if (i >= 0) {
      if (p.write >= 0.5) actions.setParam(mod, `m${sel}`, (p[`m${sel}`] ?? 0) ^ (1 << i))
      else if (i < POCKET_SOUNDS.length) {
        actions.setParam(mod, 'sel', i)
        sendSurface(mod, 'hit', i, 0, true)
        setLockStep(null)
      }
      return
    }
    if (Math.abs(fy - KNOB_Y) < 0.1) {
      const fnHit = FN.findIndex((f) => Math.abs(fx - f.x) < 0.09)
      if (fnHit >= 0) {
        const id = fnHit === 0 ? 'run' : 'write'
        actions.setParam(mod, id, p[id] >= 0.5 ? 0 : 1)
        if (id === 'write') setLockStep(null)
      }
    }
  }

  // Right-click a step (WRITE on) to lock A/B for it; double-click a knob to
  // clear its lock (the canvas knobs handle that).
  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (params.current.write < 0.5) return
    const { fx, fy } = region(e)
    const i = gridIndex(fx, fy)
    if (i >= 0) setLockStep((cur) => (cur === i ? null : i))
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
      onPointerDown={down}
      onContextMenu={context}
    />
  )
}
