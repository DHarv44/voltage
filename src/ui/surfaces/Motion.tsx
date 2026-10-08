import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { SPECS } from '../../modules'
import { fromNorm, toNorm } from '../../modules/params'
import { hasId, LANE, LANE_NAMES, MOTION_LANES, MOTION_POINTS, MOTION_RES, MOTL, pointId } from '../../modules/specs/motion'
import type { ModuleInst, MorphSnapshot, Patch } from '../../patch/types'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { captureSnapshot, keyInfo } from '../xy/morph'
import { fitFont, RES, sendSurface, useFrame, type SurfaceProps } from './common'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const COLORS = ['#ff8fd1', '#8fd8ff', '#ffd27a', '#a6ff9a']

/** A lane's knob: the one key stored in its morph slot ("moduleId/param"). */
const targetOf = (m: ModuleInst | undefined, l: number): string | undefined => {
  const snap = m?.morph?.[l]
  return snap ? Object.keys(snap)[0] : undefined
}

interface Arm {
  lane: number
  /** Every knob as it was when REC was pressed: the first to differ is learned. */
  snap: MorphSnapshot
  key?: string
  /** The engine has started recording (so "playing" afterwards means done). */
  started: boolean
}

/** MOTION's screen: four lanes, each its learned knob's name, the recorded
 *  curve and where it is now; a playhead across all four. Click a lane to arm
 *  it (click again to cancel), right-click to clear it. This side also learns
 *  the knob, streams it to the engine while recording, and turns it on
 *  playback (as MACRO does). */
export function Motion({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const arm = useRef<Arm | null>(null)

  useEffect(() => {
    const applied = new Float64Array(MOTION_LANES).fill(-1)
    const self = (p: Patch) => p.modules.find((m) => m.id === mod)
    // knobs that playback moves are never "the one you turned"
    const playing = (p: Patch) => {
      const m = self(p)
      const keys = new Set<string>()
      for (let l = 0; l < MOTION_LANES; l++) {
        const k = targetOf(m, l)
        if (k && (m?.params[hasId(l)] ?? 0) >= 0.5) keys.add(k)
      }
      return keys
    }
    const onStore = () => {
      const a = arm.current
      if (!a) return
      const p = patchStore.get()
      if (!a.key) {
        const now = captureSnapshot(p)
        const skip = playing(p)
        for (const key of Object.keys(now)) {
          if (skip.has(key) || a.snap[key] === undefined || Math.abs(now[key] - a.snap[key]) < 1e-9) continue
          a.key = key
          actions.setMorphCorner(mod, a.lane, { [key]: 1 })
          break
        }
      }
      const info = a.key ? keyInfo(p, a.key) : null
      if (info) sendSurface(mod, 'val', a.lane, toNorm(info.ps, info.m.params[info.param]), true)
    }
    const onTelemetry = () => {
      const led = telemetry.leds[mod]
      if (!led) return
      const a = arm.current
      if (a) {
        const st = led[MOTL.state + a.lane]
        if (st === LANE.recording) a.started = true
        else if (a.started && st === LANE.playing) arm.current = null // one loop recorded
      }
      const p = patchStore.get()
      const m = self(p)
      const updates: [string, string, number][] = []
      for (let l = 0; l < MOTION_LANES; l++) {
        if (led[MOTL.state + l] !== LANE.playing || arm.current?.lane === l) continue
        const info = keyInfo(p, targetOf(m, l) ?? '')
        if (!info) continue
        const v = led[MOTL.value + l]
        if (Math.abs(v - applied[l]) < 0.0005) continue
        applied[l] = v
        updates.push([info.id, info.param, fromNorm(info.ps, v)])
      }
      actions.setParamsLive(updates)
    }
    const a = patchStore.subscribe(onStore)
    const b = telemetry.subscribe(onTelemetry)
    return () => {
      a()
      b()
    }
  }, [mod])

  useFrame(ref, (now) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = patchStore.get()
    const m = p.modules.find((q) => q.id === mod) ?? inst
    const led = telemetry.leds[mod]
    ctx.fillStyle = '#140d14'
    ctx.fillRect(0, 0, W, H)
    const lh = H / MOTION_LANES
    const cx0 = W * 0.3
    const cw = W * 0.68
    for (let l = 0; l < MOTION_LANES; l++) {
      const y0 = l * lh
      const st = led?.[MOTL.state + l] ?? (m.params[hasId(l)] >= 0.5 ? LANE.playing : LANE.empty)
      const armed = arm.current?.lane === l
      const color = COLORS[l]
      // the lane button: letter and state
      const blink = Math.floor(now / 300) % 2 === 0
      const btn = st === LANE.recording ? '#e8402f' : armed ? (blink ? '#8a2f5f' : '#3a1a30') : '#2a1d2a'
      ctx.fillStyle = btn
      ctx.beginPath()
      ctx.roundRect(W * 0.01, y0 + lh * 0.1, W * 0.27, lh * 0.8, lh * 0.15)
      ctx.fill()
      ctx.fillStyle = color
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = `700 ${Math.round(lh * 0.36)}px ${FONT}`
      ctx.fillText(LANE_NAMES[l], W * 0.03, y0 + lh * 0.38)
      const word = st === LANE.recording ? '● REC' : armed ? 'TURN A KNOB' : st === LANE.playing ? 'PLAY' : 'REC'
      ctx.fillStyle = '#f2e6f0'
      fitFont(ctx, word, W * 0.17, lh * 0.24, FONT, '600')
      ctx.fillText(word, W * 0.095, y0 + lh * 0.38)
      // which knob
      const info = keyInfo(p, targetOf(m, l) ?? '')
      const name = info ? `${SPECS[info.m.type].title} · ${info.ps.label}` : '—'
      ctx.fillStyle = 'rgba(242,230,240,0.7)'
      fitFont(ctx, name, W * 0.25, lh * 0.2, FONT)
      ctx.fillText(name, W * 0.03, y0 + lh * 0.7)
      // the recorded curve
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.strokeRect(cx0, y0 + lh * 0.1, cw, lh * 0.8)
      if (m.params[hasId(l)] >= 0.5 || st === LANE.recording) {
        ctx.strokeStyle = color
        ctx.lineWidth = Math.max(1.5, lh * 0.04)
        ctx.beginPath()
        for (let i = 0; i <= MOTION_POINTS; i++) {
          const v = (m.params[pointId(l, i % MOTION_POINTS)] ?? 0) / MOTION_RES
          const px = cx0 + (i / MOTION_POINTS) * cw
          const py = y0 + lh * 0.85 - v * lh * 0.7
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      // where the lane is now
      const v = led?.[MOTL.value + l] ?? 0
      const hx = cx0 + (led?.[MOTL.head] ?? 0) * cw
      if (st !== LANE.empty) {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(hx, y0 + lh * 0.85 - v * lh * 0.7, lh * 0.07, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // the playhead
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1.5
    const hx = cx0 + (led?.[MOTL.head] ?? 0) * cw
    ctx.beginPath()
    ctx.moveTo(hx, 0)
    ctx.lineTo(hx, H)
    ctx.stroke()
  })

  const laneAt = (e: { clientY: number; currentTarget: Element }) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.min(MOTION_LANES - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * MOTION_LANES)))
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const l = laneAt(e)
    const cur = arm.current
    if (cur) sendSurface(mod, 'arm', cur.lane, 0, false)
    if (cur?.lane === l) {
      arm.current = null
      return
    }
    arm.current = { lane: l, snap: captureSnapshot(patchStore.get()), started: false }
    sendSurface(mod, 'arm', l, 0, true)
  }

  const clear = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const l = laneAt(e)
    if (arm.current?.lane === l) arm.current = null
    sendSurface(mod, 'clear', l, 0, true)
    actions.setMorphCorner(mod, l, null)
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }}
      onPointerDown={down}
      onContextMenu={clear}
    />
  )
}
