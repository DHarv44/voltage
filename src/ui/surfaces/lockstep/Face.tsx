import { useMemo, useRef, type MouseEvent, type PointerEvent } from 'react'
import { telemetry } from '../../../audio/telemetry'
import {
  condId,
  encoderLabels,
  encoderParams,
  LOCK_PAGES,
  lockId,
  lockValue,
  LS_CONDS,
  LS_RETRIGS,
  LS_STEPS,
  LS_TRACK_COLORS,
  LSL,
  microId,
  retrigId,
  trigsId,
  withLock,
} from '../../../modules/specs/lockstep'
import { actions, patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { track } from '../../pointer'
import { drawCanvasKnob, useCanvasKnobs, type CanvasKnob } from '../canvasKnob'
import { RES, useFrame, type SurfaceProps } from '../common'
import { lsButtons } from './buttons'
import { lsNote } from './clipboard'
import { BTN, chainRec, ENC_R, ENC_X, ENC_Y, keyAt, keyRect, LABEL_Y, lockstepSel, SCREEN } from './layout'
import { drawLsScreen, hasLocks } from './screen'

const LOCK = '#ff8a2b'
const HOLD_MS = 450
const FAMILY = "Bahnschrift, 'Arial Narrow', sans-serif"

/** LOCKSTEP's face. Click a step key to toggle its trig; right-click (or hold)
 *  it to pick the step: then the FM / AMP / FX encoders lock their knob on
 *  that step (double-click an encoder to unlock it) and TRIG edits its note
 *  and condition. A–D pick the pattern the keys and screen show and edit.
 *  The screen shows every track's steps under the values. */
export function LockstepFace({ inst, spec, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const byId = useMemo(() => new Map(spec.params.map((ps) => [ps.id, ps])), [spec])
  const specOf = (id: string) => byId.get(id)!
  const live = () => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const set = (id: string, v: number) => actions.setParam(mod, id, v)
  const sel = () => lockstepSel.get(mod)

  const knobs = (): CanvasKnob[] => {
    const p = live()
    const page = Math.round(p.page)
    const t = Math.round(p.trk)
    const s = sel()
    const labels = encoderLabels(p)
    return encoderParams(p, s).flatMap((id, i): CanvasKnob[] => {
      if (!id) return []
      const ps = specOf(id)
      const base = { fx: ENC_X[i], fy: ENC_Y, fr: ENC_R, ps, label: labels[i] }
      if (page >= LOCK_PAGES || s < 0) return [{ ...base, value: p[id] ?? ps.def, set: (v) => set(id, v) }]
      // a step is picked: this knob's lock on it
      const wid = lockId(t, s, page, Math.round(p.pat ?? 0))
      const lv = lockValue(p[wid] ?? 0, i)
      return [
        {
          ...base,
          label: `${labels[i]} · step ${s + 1} lock`,
          value: lv >= 0 ? lv : (p[id] ?? ps.def),
          set: (v) => set(wid, withLock(live()[wid] ?? 0, i, v)),
          reset: () => set(wid, withLock(live()[wid] ?? 0, i, -1)),
        },
      ]
    })
  }
  const pressKnob = useCanvasKnobs(ref, mod, knobs)

  const buttons = () => lsButtons(mod, live(), Math.round(telemetry.leds[mod]?.[LSL.pat] ?? 0))

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const led = telemetry.leds[mod]
    const s = sel()
    ctx.fillStyle = '#2b2c30'
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, H * 0.04)
    ctx.fill()
    drawLsScreen(ctx, { x: SCREEN.x * W, y: SCREEN.y * H, w: SCREEN.w * W, h: SCREEN.h * H }, { p, led, sel: s, spec: specOf, note: lsNote.get(mod), writing: chainRec.has(mod) })
    const page = Math.round(p.page)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    knobs().forEach((k) => {
      const lockEdit = page < LOCK_PAGES && s >= 0
      drawCanvasKnob(ctx, k, W, H, { body: '#3d3f45', pointer: lockEdit ? LOCK : '#e6e3dc', ticks: 'rgba(230,227,220,0.4)' })
      ctx.fillStyle = lockEdit ? LOCK : '#d8d9dc'
      ctx.font = `600 ${Math.round(H * 0.05)}px ${FAMILY}`
      ctx.fillText(k.label?.split(' · ')[0] ?? '', k.fx * W, LABEL_Y * H)
    })
    for (const b of buttons()) {
      const bw = BTN.w * W
      const bh = BTN.h * H
      ctx.fillStyle = b.lit ? (b.color ?? LOCK) : '#45474d'
      ctx.beginPath()
      ctx.roundRect(b.x * W - bw / 2, b.y * H - bh / 2, bw, bh, bh * 0.2)
      ctx.fill()
      if (b.color && !b.lit) {
        ctx.fillStyle = b.color
        ctx.fillRect(b.x * W - bw / 2 + bh * 0.2, b.y * H + bh * 0.3, bw - bh * 0.4, bh * 0.1)
      }
      ctx.fillStyle = b.lit ? '#141414' : '#e6e3dc'
      ctx.font = `700 ${Math.round(Math.min(bh * 0.4, bw * 0.2))}px ${FAMILY}`
      ctx.fillText(b.label, b.x * W, b.y * H)
    }
    drawKeys(ctx, p, led, s)
  })

  /** The sixteen step keys for the selected track. */
  function drawKeys(ctx: CanvasRenderingContext2D, p: Record<string, number>, led: ArrayLike<number> | undefined, s: number) {
    const t = Math.round(p.trk)
    const pat = Math.round(p.pat ?? 0)
    const len = Math.round(p[`len${t}`])
    const mask = Math.round(p[trigsId(t, pat)])
    // the playhead only over the pattern that's playing
    const at = Math.round(led?.[LSL.pat] ?? 0) === pat ? (led?.[LSL.step + t] ?? -1) : -1
    const color = LS_TRACK_COLORS[t]
    for (let st = 0; st < LS_STEPS; st++) {
      const r = keyRect(st)
      const kx = r.x * W
      const ky = r.y * H
      const kw = r.w * W
      const kh = r.h * H
      const on = ((mask >>> st) & 1) === 1
      ctx.globalAlpha = st < len ? 1 : 0.3
      ctx.fillStyle = on ? color : '#3a3b40'
      ctx.beginPath()
      ctx.roundRect(kx, ky, kw, kh, kh * 0.12)
      ctx.fill()
      if (st === at) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.fill()
      }
      if (st === s) {
        ctx.strokeStyle = LOCK
        ctx.lineWidth = Math.max(3, kh * 0.06)
        ctx.stroke()
      }
      ctx.fillStyle = on ? '#141414' : 'rgba(230,227,220,0.55)'
      ctx.font = `600 ${Math.round(kh * 0.2)}px ${FAMILY}`
      ctx.textAlign = 'left'
      ctx.fillText(String(st + 1), kx + kw * 0.12, ky + kh * 0.2)
      if (hasLocks(p, t, st, pat)) {
        ctx.fillStyle = on ? '#141414' : LOCK
        ctx.beginPath()
        ctx.arc(kx + kw * 0.8, ky + kh * 0.2, kh * 0.07, 0, Math.PI * 2)
        ctx.fill()
      }
      const cond = Math.round(p[condId(t, st, pat)] ?? 0)
      if (cond > 0) {
        ctx.textAlign = 'center'
        ctx.font = `700 ${Math.round(Math.min(kh * 0.2, kw * 0.22))}px ${FAMILY}`
        ctx.fillText(LS_CONDS[cond], kx + kw / 2, ky + kh * 0.75)
      }
      // a ratchet (×2…×4) and a nudge (◂ early, ▸ late)
      const rt = Math.round(p[retrigId(t, st, pat)] ?? 0)
      const mt = Math.round(p[microId(t, st, pat)] ?? 0)
      if (rt > 0 || mt !== 0) {
        ctx.textAlign = 'left'
        ctx.font = `700 ${Math.round(Math.min(kh * 0.18, kw * 0.2))}px ${FAMILY}`
        ctx.fillText(`${mt < 0 ? '◂' : ''}${rt > 0 ? LS_RETRIGS[rt] : ''}${mt > 0 ? '▸' : ''}`, kx + kw * 0.12, ky + kh * 0.48)
      }
      ctx.globalAlpha = 1
    }
    ctx.textAlign = 'center'
  }

  const fractions = (e: { clientX: number; clientY: number }, el: Element) => {
    const b = el.getBoundingClientRect()
    return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]
  }
  const pick = (s: number) => lockstepSel.set(mod, sel() === s ? -1 : s)

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pressKnob(e)) return
    const [fx, fy] = fractions(e, e.currentTarget)
    const step = keyAt(fx, fy)
    if (step >= 0) {
      e.stopPropagation()
      e.preventDefault()
      if (e.button === 2) return pick(step)
      if (e.button !== 0) return
      // a tap toggles the trig; holding picks the step instead
      let held = false
      const timer = window.setTimeout(() => {
        held = true
        pick(step)
      }, HOLD_MS)
      track(
        () => {},
        () => {
          window.clearTimeout(timer)
          if (held) return
          const p = live()
          const id = trigsId(Math.round(p.trk), Math.round(p.pat ?? 0))
          set(id, Math.round(p[id]) ^ (1 << step))
        },
      )
      return
    }
    if (e.button !== 0) return
    const hit = buttonAt(fx, fy)
    if (!hit) return
    e.stopPropagation()
    e.preventDefault()
    if (hit.hold) {
      // a short tap presses; held, it does its other job
      let held = false
      const timer = window.setTimeout(() => {
        held = true
        hit.hold!()
      }, HOLD_MS)
      track(
        () => {},
        () => {
          window.clearTimeout(timer)
          if (!held) hit.press()
        },
      )
      return
    }
    hit.press()
    if (hit.release) track(() => {}, hit.release)
  }
  const buttonAt = (fx: number, fy: number) => buttons().find((b) => Math.abs(fx - b.x) < BTN.w / 2 && Math.abs(fy - b.y) < BTN.h / 2)
  /** Right-click on a step key picks it, on a track button mutes it (not the module menu). */
  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    const [fx, fy] = fractions(e, e.currentTarget)
    const b = buttonAt(fx, fy)
    if (keyAt(fx, fy) < 0 && !b?.hold) return
    e.preventDefault()
    e.stopPropagation()
    b?.hold?.()
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
