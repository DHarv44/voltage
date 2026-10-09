import { useRef, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { ARCADE_MODES, ARCADE_VOICES, ROBOT_MODES, ROBOT_VOICES, SPEAK_SYLLABLES, SPEAK_VOICES, BASS_NOTES, BASS_VOICES, MELODY_MODES, MELODY_NOTES, MELODY_VOICES, PSL, PSTEPS, ROOTS, SCALE_STEPS } from '../../modules/specs/pocketSynth'
import { drawMascot } from './pocketMascots'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
import { drawCanvasKnob, useCanvasKnobs, type CanvasKnob } from './canvasKnob'
import { RES, sendSurface, useFrame, type SurfaceProps } from './common'

/** Regions as fractions of the surface (the same face as the drum POCKET). */
const LCD = { x: 0.05, y: 0.03, w: 0.9, h: 0.27 }
const KNOB_Y = 0.4
const KNOBS = [0.16, 0.39]
const FN = [
  { x: 0.64, name: 'PLAY' },
  { x: 0.86, name: 'WRITE' },
]
const GRID = { x: 0.05, y: 0.52, w: 0.9, h: 0.46 }
const INK = '#26301e'

/** What differs between the melodic POCKETs' faces. */
const FLAVOURS = {
  pocketbass: { bg: '#c3cfc6', accent: '#2d6cdf', voices: BASS_VOICES, modes: [] as string[], knobA: 'A · TONE', knobB: 'B · DECAY' },
  pocketmelody: { bg: '#dfcbcc', accent: '#8a3fc2', voices: MELODY_VOICES, modes: MELODY_MODES, knobA: 'A · TONE', knobB: 'B · DECAY' },
  pocketarcade: { bg: '#c9ced9', accent: '#d9542b', voices: ARCADE_VOICES, modes: ARCADE_MODES, knobA: 'A · VIBRATO', knobB: 'B · DECAY' },
  pocketrobot: { bg: '#cfccc5', accent: '#e8402f', voices: ROBOT_VOICES, modes: ROBOT_MODES, knobA: 'A · TONE', knobB: 'B · FX' },
  // the step's flag is its syllable (shown even for AH, the first)
  pocketspeak: { bg: '#cbd5e3', accent: '#2a6fb3', voices: SPEAK_VOICES, modes: SPEAK_SYLLABLES, knobA: 'A · THROAT', knobB: 'B · LENGTH' },
}

/** The melodic POCKETs' face. WRITE on: click a step to switch it on/off,
 *  drag it up/down (or scroll) to set its note, right-click for its flag
 *  (bass: slide / accent; melody: note / chord / arp). WRITE off: the
 *  buttons are a keyboard. The LCD is a little piano roll of the pattern. */
export function PocketKeys({ inst, spec, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const bass = inst.type === 'pocketbass'
  const look = FLAVOURS[inst.type as keyof typeof FLAVOURS] ?? FLAVOURS.pocketmelody
  const maxNote = bass ? BASS_NOTES : MELODY_NOTES
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const params = useRef(inst.params)
  params.current = inst.params

  /** A step's note as a name: bass in semitones from C, melody in its scale. */
  const noteName = (n: number) => {
    const p = params.current
    if (bass) return ROOTS[((n % 12) + 12) % 12] + (n >= 12 ? '′' : '')
    const steps = SCALE_STEPS[Math.round(p.scale)] ?? SCALE_STEPS[0]
    const semi = steps[n % steps.length] + Math.round(p.root)
    return ROOTS[semi % 12] + (n >= steps.length ? '′' : '')
  }

  // Knobs A (TONE) and B (DECAY): real params, so they turn like panel knobs.
  const knobs = (): CanvasKnob[] =>
    (['a', 'b'] as const).map((id, k) => ({
      fx: KNOBS[k],
      fy: KNOB_Y,
      fr: 0.075,
      ps: spec.params.find((s) => s.id === id)!,
      // live from the store: gestures can arrive faster than React re-renders
      value: (patchStore.get().modules.find((m) => m.id === mod)?.params ?? params.current)[id] ?? 0.5,
      set: (v: number) => actions.setParam(mod, id, v),
      label: k === 0 ? look.knobA : look.knobB,
    }))
  const pressKnob = useCanvasKnobs(ref, mod, knobs)

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = params.current
    const led = telemetry.leds[mod]
    const step = led?.[PSL.step] ?? -1
    const flash = led?.[PSL.flash] ?? 0
    const mask = p.m ?? 0
    const write = p.write >= 0.5
    ctx.fillStyle = look.bg
    ctx.fillRect(0, 0, W, H)

    // LCD: voice and tempo, then the pattern as a little piano roll.
    const lx = LCD.x * W
    const ly = LCD.y * H
    const lw = LCD.w * W
    const lh = LCD.h * H
    ctx.fillStyle = '#9fb08c'
    ctx.fillRect(lx, ly, lw, lh)
    ctx.fillStyle = INK
    ctx.font = `600 ${Math.round(lh * 0.18)}px Consolas, 'Courier New', monospace`
    ctx.textAlign = 'left'
    const voice = look.voices[Math.round(p.voice)] ?? ''
    ctx.fillText(bass ? voice : `${voice} ${ROOTS[Math.round(p.root)]}`, lx + lw * 0.03, ly + lh * 0.22)
    ctx.textAlign = 'right'
    // following another POCKET's CLK: its tempo, not ours
    const ext = patchStore.get().cables.some((c) => c.to.mod === mod && c.to.jack === 'clk')
    // recording (POCKET ROBOT): a red dot, blinking while it plays
    const rec = (p.rec ?? 0) >= 0.5 && (step < 0 || Math.floor(performance.now() / 400) % 2 === 0)
    ctx.fillText(`${rec ? '● REC  ' : ''}${ext ? 'EXT' : Math.round(p.tempo)}`, lx + lw * 0.97, ly + lh * 0.22)
    const rollTop = ly + lh * 0.32
    const rollH = lh * 0.6
    const cw = (lw * 0.94) / PSTEPS
    let prevY = -1
    for (let i = 0; i < PSTEPS; i++) {
      const cx = lx + lw * 0.03 + i * cw
      if (i === step) {
        ctx.fillStyle = 'rgba(38,48,30,0.15)'
        ctx.fillRect(cx, rollTop, cw, rollH)
      }
      if (!(mask & (1 << i))) {
        prevY = -1
        continue
      }
      const n = p[`n${i}`] ?? 0
      const f = Math.round(p[`f${i}`] ?? 0)
      const ny = rollTop + rollH * (1 - n / maxNote) - lh * 0.03
      ctx.fillStyle = INK
      if (bass) {
        if (f & 1 && prevY >= 0) {
          // slide: a line from the previous note
          ctx.strokeStyle = INK
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(cx - cw * 0.2, prevY + lh * 0.02)
          ctx.lineTo(cx + 2, ny + lh * 0.02)
          ctx.stroke()
        }
        ctx.fillRect(cx + 2, ny, cw - 4, lh * (f & 2 ? 0.07 : 0.04)) // accent: a bolder bar
      } else if (f === 1) {
        for (let k = 0; k < 3; k++) ctx.fillRect(cx + 2, ny - k * lh * 0.07, cw - 4, lh * 0.035)
      } else if (f === 2) {
        for (let k = 0; k < 3; k++) ctx.fillRect(cx + 2 + (k * (cw - 4)) / 3, ny - k * lh * 0.07, (cw - 4) / 3 - 1, lh * 0.035)
      } else ctx.fillRect(cx + 2, ny, cw - 4, lh * 0.04)
      prevY = ny
    }
    drawMascot(ctx, inst.type, lx + lw * 0.62, ly + lh * 0.14, lh, flash, INK)

    // Knobs A (TONE) and B (DECAY).
    for (const knob of knobs()) {
      drawCanvasKnob(ctx, knob, W, H, { body: '#2a2a2a', pointer: '#eee', ticks: '#4a4540' })
      ctx.fillStyle = '#2a2520'
      ctx.textAlign = 'center'
      ctx.font = `${Math.round(H * 0.035)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText(knob.label ?? '', knob.fx * W, (knob.fy + knob.fr) * H + H * 0.05)
    }
    FN.forEach((f, k) => {
      const on = k === 0 ? p.run >= 0.5 : write
      ctx.fillStyle = on ? look.accent : '#4a4540'
      ctx.beginPath()
      ctx.roundRect(f.x * W - W * 0.08, KNOB_Y * H - H * 0.045, W * 0.16, H * 0.09, 6)
      ctx.fill()
      ctx.fillStyle = '#f2eee6'
      ctx.font = `600 ${Math.round(H * 0.035)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText(f.name, f.x * W, KNOB_Y * H + H * 0.012)
    })

    // 4×4 buttons: steps (WRITE) or keys.
    const bw = (GRID.w * W) / 4
    const bh = (GRID.h * H) / 4
    const playing = led?.[PSL.note] ?? -1
    for (let i = 0; i < 16; i++) {
      const bx = GRID.x * W + (i % 4) * bw
      const by = GRID.y * H + Math.floor(i / 4) * bh
      const on = write ? !!(mask & (1 << i)) : flash > 0.4 && i === Math.round(playing)
      ctx.fillStyle = on ? '#3a3632' : '#efe9dc'
      ctx.beginPath()
      ctx.roundRect(bx + 4, by + 4, bw - 8, bh - 8, 6)
      ctx.fill()
      if (write && i === step) {
        ctx.strokeStyle = look.accent
        ctx.lineWidth = 3
        ctx.stroke()
      }
      ctx.fillStyle = on ? '#f2eee6' : '#3a3632'
      ctx.textAlign = 'center'
      ctx.font = `${Math.round(bh * 0.24)}px Bahnschrift, 'Arial Narrow', sans-serif`
      const label = write ? noteName(p[`n${i}`] ?? 0) : noteName(i)
      ctx.fillText(write && !on ? String(i + 1) : label, bx + bw / 2, by + bh * 0.48)
      if (write && on) {
        const f = Math.round(p[`f${i}`] ?? 0)
        const tag = bass ? [f & 1 ? 'SLIDE' : '', f & 2 ? 'ACC' : ''].filter(Boolean).join(' ') : f || inst.type === 'pocketspeak' ? look.modes[f] : ''
        if (tag) {
          ctx.font = `${Math.round(bh * 0.15)}px Bahnschrift, 'Arial Narrow', sans-serif`
          ctx.fillText(tag, bx + bw / 2, by + bh * 0.74)
        }
      }
    }
  })

  const region = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, r }
  }
  const gridIndex = (fx: number, fy: number) => {
    if (fy < GRID.y || fx < GRID.x || fx > GRID.x + GRID.w) return -1
    return Math.min(3, Math.floor(((fy - GRID.y) / GRID.h) * 4)) * 4 + Math.min(3, Math.floor(((fx - GRID.x) / GRID.w) * 4))
  }
  const setNote = (i: number, n: number) => {
    const v = Math.max(0, Math.min(maxNote, n))
    actions.setParams([
      [mod, `n${i}`, v],
      [mod, 'm', (params.current.m ?? 0) | (1 << i)],
    ], `pocket-note-${mod}-${i}`)
    return v
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pressKnob(e)) return // A/B knobs: left or middle drag
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const { fx, fy, r } = region(e)
    const p = params.current
    const i = gridIndex(fx, fy)
    if (i >= 0) {
      if (p.write < 0.5) {
        // keyboard: the note sounds while held
        sendSurface(mod, 'key', i, 0, true)
        track(
          () => {},
          () => sendSurface(mod, 'key', i, 0, false),
        )
        return
      }
      // WRITE: click toggles the step; drag up/down sets its note (and hears it)
      const start = { y: e.clientY, n: p[`n${i}`] ?? 0, moved: false }
      track(
        (ev) => {
          const dn = Math.round((start.y - ev.clientY) / (r.height * 0.035))
          if (!start.moved && dn === 0) return
          start.moved = true
          const n = setNote(i, start.n + dn)
          sendSurface(mod, 'key', n, 0, true)
        },
        () => {
          if (start.moved) sendSurface(mod, 'key', 0, 0, false)
          else actions.setParam(mod, 'm', (params.current.m ?? 0) ^ (1 << i))
        },
      )
      return
    }
    if (Math.abs(fy - KNOB_Y) < 0.1) {
      const fnHit = FN.findIndex((f) => Math.abs(fx - f.x) < 0.09)
      if (fnHit >= 0) {
        const id = fnHit === 0 ? 'run' : 'write'
        actions.setParam(mod, id, p[id] >= 0.5 ? 0 : 1)
      }
    }
  }

  // Right-click a step (WRITE): its flag. Bass: none → slide → accent → both.
  // Melody: note → chord → arp.
  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const p = params.current
    if (p.write < 0.5) return
    const { fx, fy } = region(e)
    const i = gridIndex(fx, fy)
    if (i < 0) return
    const f = Math.round(p[`f${i}`] ?? 0)
    actions.setParam(mod, `f${i}`, (f + 1) % (bass ? 4 : look.modes.length))
  }

  // Scroll over a step (WRITE) to nudge its note.
  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const p = params.current
    if (p.write < 0.5) return
    const { fx, fy } = region(e)
    const i = gridIndex(fx, fy)
    if (i < 0) return
    e.stopPropagation()
    setNote(i, (p[`n${i}`] ?? 0) + (e.deltaY < 0 ? 1 : -1))
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
      onWheel={wheel}
    />
  )
}
