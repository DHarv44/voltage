import { useRef, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { telemetry } from '../../audio/telemetry'
import { BASS_NOTES, BASS_VOICES, MELODY_MODES, MELODY_NOTES, MELODY_VOICES, PSL, PSTEPS, ROOTS, SCALE_STEPS } from '../../modules/specs/pocketSynth'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import { track } from '../pointer'
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

/** The melodic POCKETs' face. WRITE on: click a step to switch it on/off,
 *  drag it up/down (or scroll) to set its note, right-click for its flag
 *  (bass: slide / accent; melody: note / chord / arp). WRITE off: the
 *  buttons are a keyboard. The LCD is a little piano roll of the pattern. */
export function PocketKeys({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const bass = inst.type === 'pocketbass'
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

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = params.current
    const led = telemetry.leds[mod]
    const step = led?.[PSL.step] ?? -1
    const flash = led?.[PSL.flash] ?? 0
    const mask = p.m ?? 0
    const write = p.write >= 0.5
    ctx.fillStyle = bass ? '#c3cfc6' : '#dfcbcc'
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
    const voice = (bass ? BASS_VOICES : MELODY_VOICES)[Math.round(p.voice)] ?? ''
    ctx.fillText(bass ? voice : `${voice} ${ROOTS[Math.round(p.root)]}`, lx + lw * 0.03, ly + lh * 0.22)
    ctx.textAlign = 'right'
    // following another POCKET's CLK: its tempo, not ours
    const ext = patchStore.get().cables.some((c) => c.to.mod === mod && c.to.jack === 'clk')
    ctx.fillText(ext ? 'EXT' : `${Math.round(p.tempo)}`, lx + lw * 0.97, ly + lh * 0.22)
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
    // mascot: bass, a speaker cone that pumps; melody, a little bird that sings
    const mx = lx + lw * 0.62
    const my = ly + lh * 0.14
    ctx.fillStyle = INK
    if (bass) {
      ctx.beginPath()
      ctx.arc(mx, my, lh * (0.06 + flash * 0.03), 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(mx, my, lh * (0.11 + flash * 0.02), 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.ellipse(mx, my + lh * 0.02, lh * 0.08, lh * 0.06, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(mx + lh * 0.07, my - flash * lh * 0.03)
      ctx.lineTo(mx + lh * 0.14, my - lh * 0.01 - flash * lh * 0.05)
      ctx.lineTo(mx + lh * 0.07, my + lh * 0.03)
      ctx.fill()
      if (flash > 0.3) ctx.fillText('♪', mx + lh * 0.3, my - flash * lh * 0.06)
    }

    // Knobs A (TONE) and B (DECAY).
    KNOBS.forEach((kx, k) => {
      const v = (k === 0 ? p.a : p.b) ?? 0.5
      const cx = kx * W
      const cy = KNOB_Y * H
      const r = H * 0.075
      ctx.fillStyle = '#2a2a2a'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      const a = (-135 + 270 * v) * (Math.PI / 180) - Math.PI / 2
      ctx.strokeStyle = '#eee'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8)
      ctx.stroke()
      ctx.fillStyle = '#2a2520'
      ctx.textAlign = 'center'
      ctx.font = `${Math.round(H * 0.035)}px Bahnschrift, 'Arial Narrow', sans-serif`
      ctx.fillText(k === 0 ? 'A · TONE' : 'B · DECAY', cx, cy + r + H * 0.04)
    })
    FN.forEach((f, k) => {
      const on = k === 0 ? p.run >= 0.5 : write
      ctx.fillStyle = on ? (bass ? '#2d6cdf' : '#8a3fc2') : '#4a4540'
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
        ctx.strokeStyle = bass ? '#2d6cdf' : '#8a3fc2'
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
        const tag = bass ? [f & 1 ? 'SLIDE' : '', f & 2 ? 'ACC' : ''].filter(Boolean).join(' ') : f ? MELODY_MODES[f] : ''
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
        return
      }
      const k = KNOBS.findIndex((kx) => Math.abs(fx - kx) < 0.1)
      if (k < 0) return
      const id = k === 0 ? 'a' : 'b'
      const start = { y: e.clientY, v: p[id] ?? 0.5 }
      track(
        (ev) => actions.setParam(mod, id, Math.min(1, Math.max(0, start.v + (start.y - ev.clientY) / (r.height * 0.6)))),
        () => {},
      )
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
    actions.setParam(mod, `f${i}`, (f + 1) % (bass ? 4 : 3))
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
