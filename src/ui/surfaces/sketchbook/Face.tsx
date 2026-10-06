import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../../audio/telemetry'
import {
  DRIFT,
  encoderLabels,
  encoderParams,
  MIX,
  PATTERN,
  SB_COLORS,
  SB_ENGINES,
  SB_MODES,
  SB_PAGES,
  SB_SEQS,
  SB_STEPS,
  SB_TRACKS,
  SBL,
  SEQ,
  SYNTH,
  TAPE,
  TUMBLE,
} from '../../../modules/specs/sketchbook'
import { actions, patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { drawCanvasKnob, useCanvasKnobs, type CanvasKnob } from '../canvasKnob'
import { RES, sendSurface, useFrame, type SurfaceProps } from '../common'
import { sketchCursor } from './cursor'
import { drawScreen } from './screen'

/** Layout as fractions of the face. */
const SCREEN = { x: 0.012, y: 0.07, w: 0.36, h: 0.86 }
const ENC_X = [0.43, 0.52, 0.61, 0.7]
const ENC_Y = 0.34
const ENC_R = 0.19
const MODE_Y = 0.84
const CLUSTER_X = [0.78, 0.84, 0.9, 0.96]
const ROW_Y = [0.3, 0.75]
const BTN = { w: 0.05, h: 0.3 }

interface Button {
  label: string
  x: number
  y: number
  w: number
  lit?: boolean
  off?: boolean
  press: () => void
}

/** SKETCHBOOK's face: the screen, four encoders that mean whatever the mode
 *  says (their colours match the screen), a mode button under each, and the
 *  cluster: ◀ ▶ (engine / step / track), the mode's action, octave, REC, PLAY. */
export function SketchFace({ inst, spec, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const live = () => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const set = (id: string, v: number) => actions.setParam(mod, id, v)

  const knobs = (): CanvasKnob[] => {
    const p = live()
    const specOf = (id: string) => spec.params.find((s) => s.id === id)!
    const labels = encoderLabels(p, (id) => specOf(id).label)
    return encoderParams(Math.round(p.mode), Math.round(p.page), Math.round(p.engine), Math.round(p.stype)).map((id, i) => {
      const ps = specOf(id)
      return { fx: ENC_X[i], fy: ENC_Y, fr: ENC_R, ps, value: p[id] ?? ps.def, set: (v) => set(id, v), label: labels[i] }
    })
  }
  const pressKnob = useCanvasKnobs(ref, knobs)

  /** SEQ's action button, by sequencer type. */
  const seqAction = (type: number, len: number): Button | null => {
    const at = { x: CLUSTER_X[2], y: ROW_Y[0], w: BTN.w }
    if (type === PATTERN)
      return {
        ...at,
        label: 'REST',
        press: () => {
          const c = sketchCursor.get(mod)
          set(`n${c}`, -1)
          sketchCursor.set(mod, c + 1, len)
        },
      }
    if (type === TUMBLE) return { ...at, label: 'KICK', press: () => sendSurface(mod, 'kick', 0, 0, true) }
    if (type === DRIFT)
      return {
        ...at,
        label: 'KEEP',
        // write the drifted notes back into the pattern
        press: () => {
          const led = telemetry.leds[mod]
          if (!led) return
          actions.setParams(
            Array.from({ length: SB_STEPS }, (_, i) => [mod, `n${i}`, led[SBL.drift + i]] as [string, string, number]),
            `keep:${mod}`,
          )
        },
      }
    return null
  }

  const buttons = (): Button[] => {
    const p = live()
    const mode = Math.round(p.mode)
    const len = Math.max(1, Math.round(p.len))
    const move = (d: number) => () => {
      if (mode === SYNTH) set('engine', (Math.round(p.engine) + d + SB_ENGINES.length) % SB_ENGINES.length)
      else if (mode === SEQ) sketchCursor.set(mod, sketchCursor.get(mod) + d, len)
      else if (mode === TAPE) set('trk', (Math.round(p.trk) + d + SB_TRACKS) % SB_TRACKS)
    }
    const action: Button | null =
      mode === SYNTH
        ? { label: 'PAGE', x: CLUSTER_X[2], y: ROW_Y[0], w: BTN.w, press: () => set('page', (Math.round(p.page) + 1) % SB_PAGES.length) }
        : mode === SEQ
          ? seqAction(Math.round(p.stype), len)
          : mode === TAPE
            ? { label: 'CLEAR', x: CLUSTER_X[2], y: ROW_Y[0], w: BTN.w, press: () => sendSurface(mod, 'clear', Math.round(p.trk), 0, true) }
            : null
    const rec = (telemetry.leds[mod]?.[SBL.rec] ?? 0) > 0.5
    return [
      ...SB_MODES.map((label, i) => ({ label, x: ENC_X[i], y: MODE_Y, w: 0.075, lit: mode === i, press: () => set('mode', i) })),
      { label: '◀', x: CLUSTER_X[0], y: ROW_Y[0], w: BTN.w, off: mode === MIX, press: move(-1) },
      { label: '▶', x: CLUSTER_X[1], y: ROW_Y[0], w: BTN.w, off: mode === MIX, press: move(1) },
      ...(action ? [action] : []),
      { label: 'OCT+', x: CLUSTER_X[3], y: ROW_Y[0], w: BTN.w, press: () => set('oct', Math.min(2, Math.round(p.oct) + 1)) },
      { label: '● REC', x: CLUSTER_X[0], y: ROW_Y[1], w: BTN.w, lit: rec, press: () => sendSurface(mod, 'rec', 0, 0, true) },
      { label: p.run >= 0.5 ? '■ STOP' : '▶ PLAY', x: CLUSTER_X[1], y: ROW_Y[1], w: BTN.w, lit: p.run >= 0.5, press: () => set('run', p.run >= 0.5 ? 0 : 1) },
      ...(mode === SEQ ? [{ label: 'TYPE', x: CLUSTER_X[2], y: ROW_Y[1], w: BTN.w, press: () => set('stype', (Math.round(p.stype) + 1) % SB_SEQS.length) }] : []),
      { label: 'OCT−', x: CLUSTER_X[3], y: ROW_Y[1], w: BTN.w, press: () => set('oct', Math.max(-2, Math.round(p.oct) - 1)) },
    ]
  }

  useFrame(ref, (t) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const led = telemetry.leds[mod]
    ctx.fillStyle = '#e4dcc8'
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, H * 0.06)
    ctx.fill()
    drawScreen(ctx, { x: SCREEN.x * W, y: SCREEN.y * H, w: SCREEN.w * W, h: SCREEN.h * H }, { p, led, t, cursor: sketchCursor.get(mod) })
    // encoders, each named below in its colour
    knobs().forEach((k, i) => {
      drawCanvasKnob(ctx, k, W, H, { body: SB_COLORS[i], pointer: '#1b1c1e', ticks: 'rgba(40,36,30,0.55)' })
      ctx.fillStyle = '#2a2520'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `600 ${Math.round(H * 0.075)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText(k.label ?? '', k.fx * W, (ENC_Y + ENC_R * 1.75) * H)
    })
    for (const b of buttons()) {
      const bw = b.w * W
      const bh = BTN.h * H * (b.y === MODE_Y ? 0.7 : 1)
      ctx.globalAlpha = b.off ? 0.35 : 1
      ctx.fillStyle = b.lit ? (b.label === '● REC' ? '#e8402f' : '#2a2520') : '#cfc6b0'
      ctx.beginPath()
      ctx.roundRect(b.x * W - bw / 2, b.y * H - bh / 2, bw, bh, bh * 0.25)
      ctx.fill()
      ctx.fillStyle = b.lit ? '#f4efe4' : '#2a2520'
      ctx.font = `700 ${Math.round(Math.min(bh * 0.42, bw * 0.24))}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText(b.label, b.x * W, b.y * H)
      ctx.globalAlpha = 1
    }
  })

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pressKnob(e)) return
    if (e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    const hit = buttons().find((b) => !b.off && Math.abs(fx - b.x) < b.w / 2 && Math.abs(fy - b.y) < BTN.h / 2)
    if (!hit) return
    e.stopPropagation()
    e.preventDefault()
    hit.press()
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX }}
      onPointerDown={down}
    />
  )
}
