import { useRef, type PointerEvent } from 'react'
import { telemetry } from '../../../audio/telemetry'
import { ADSR_SOUND, CAL, REC, TALLY_MODES, TALLY_RHYTHMS, TALLY_SOUNDS, TLL } from '../../../modules/specs/tallyDefs'
import { actions, patchStore } from '../../../patch/store'
import { PX } from '../../geometry'
import { track } from '../../pointer'
import { fitFont, RES, sendSurface, useFrame, type SurfaceProps } from '../common'
import { Calc } from './calc'
import { inside, keyAt, keyRects, LCD, ONE_KEY, padRects, RHYTHM_BTN, type Rect } from './layout'

const FONT = "Bahnschrift, 'Arial Narrow', sans-serif"
const LCD_FONT = "'Consolas', 'Courier New', monospace"
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const noteName = (s: number) => `${NAMES[((s % 12) + 12) % 12]}${4 + Math.floor(s / 12)}`

/** TALLY's face: the LCD, ONE KEY PLAY and RHYTHM, the calculator keys and
 *  the key strip. The calculator lives here; notes go to the engine. */
export function TallyFace({ inst, x, y, w, h }: SurfaceProps) {
  const mod = inst.id
  const ref = useRef<HTMLCanvasElement>(null)
  const W = Math.round(w * PX * RES)
  const H = Math.round(h * PX * RES)
  const calc = useRef(new Calc())
  /** What's held down (lit while pressed): a pad key, 'ok', or a strip key. */
  const down = useRef<{ pad?: string; ok?: boolean; key?: number }>({})
  const live = () => patchStore.get().modules.find((m) => m.id === mod)?.params ?? inst.params
  const px = (r: Rect) => [r.x * W, r.y * H, r.w * W, r.h * H] as const

  const button = (ctx: CanvasRenderingContext2D, r: Rect, label: string, fill: string, ink: string, size: number) => {
    const [bx, by, bw, bh] = px(r)
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, Math.min(bw, bh) * 0.18)
    ctx.fill()
    ctx.fillStyle = ink
    fitFont(ctx, label, bw * 0.85, size, FONT, '700')
    ctx.fillText(label, bx + bw / 2, by + bh / 2)
  }

  useFrame(ref, () => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = live()
    const led = telemetry.leds[mod]
    const mode = Math.round(p.mode ?? 1)
    ctx.fillStyle = '#26282c'
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, H * 0.04)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // the LCD
    const [lx, ly, lw, lh] = px(LCD)
    ctx.fillStyle = '#aebb98'
    ctx.beginPath()
    ctx.roundRect(lx, ly, lw, lh, lh * 0.08)
    ctx.fill()
    ctx.fillStyle = '#1d2418'
    ctx.textAlign = 'left'
    ctx.font = `700 ${Math.round(lh * 0.17)}px ${FONT}`
    ctx.fillText(TALLY_MODES[mode], lx + lw * 0.03, ly + lh * 0.17)
    const sound = Math.round(p.sound ?? 0)
    ctx.textAlign = 'right'
    ctx.fillText(sound === ADSR_SOUND ? `ADSR ${String(Math.round(p.code)).padStart(8, '0')}` : TALLY_SOUNDS[sound], lx + lw * 0.97, ly + lh * 0.17)
    let big = '—'
    let small = ''
    if (mode === CAL) big = calc.current.display
    else {
      const n = led?.[TLL.note] ?? -99
      big = n > -99 ? noteName(n) : '—'
      const len = Math.round(led?.[TLL.mlen] ?? p.mlen ?? 0)
      small = mode === REC ? `REC ${len}/100` : len ? `ONE KEY ${Math.round(led?.[TLL.mpos] ?? 0) + 1}/${len}` : ''
    }
    const digit = led?.[TLL.digit] ?? -1
    if (digit >= 0) small = `♪ ${digit}`
    ctx.font = `700 ${Math.round(lh * 0.5)}px ${LCD_FONT}`
    ctx.fillText(big, lx + lw * 0.97, ly + lh * 0.62)
    ctx.textAlign = 'left'
    ctx.font = `600 ${Math.round(lh * 0.15)}px ${FONT}`
    ctx.fillText(small, lx + lw * 0.03, ly + lh * 0.86)
    const step = led?.[TLL.step] ?? -1
    if (step >= 0) {
      const r = TALLY_RHYTHMS[Math.round(p.rhythm ?? 0)]
      ctx.textAlign = 'right'
      ctx.fillText(`${r.name} ${'●'.repeat((Math.floor(step / 4) % 4) + 1)}`, lx + lw * 0.97, ly + lh * 0.86)
    }

    // ONE KEY PLAY and RHYTHM
    ctx.textAlign = 'center'
    button(ctx, ONE_KEY, 'ONE KEY PLAY', down.current.ok ? '#ff9a3c' : '#d9672b', '#1a1208', H * 0.07)
    const running = (p.run ?? 0) >= 0.5
    button(ctx, RHYTHM_BTN, running ? '■ RHYTHM' : '▶ RHYTHM', running ? '#5fae6b' : '#4a4d53', '#f0f0ea', H * 0.06)

    // the calculator keys
    for (const { key, r } of padRects()) {
      const op = /[+−×÷=]/.test(key)
      const special = key === '♪' || key === 'ADSR' || key === 'C'
      const fill = down.current.pad === key ? '#e8e2cf' : op ? '#5b5f66' : special ? '#7a3b2e' : '#3c3f45'
      button(ctx, r, key, fill, down.current.pad === key ? '#111' : '#f0ede4', H * 0.075)
    }

    // the key strip
    const sounding = led?.[TLL.gate] ? (led?.[TLL.note] ?? -99) : -99
    const lowest = -5 + (Math.round(p.oct ?? 1) - 1) * 12
    for (const k of keyRects()) {
      const [kx, ky, kw, kh] = px(k.r)
      const lit = down.current.key === k.key || sounding === lowest + k.key
      ctx.fillStyle = k.black ? (lit ? '#ff9a3c' : '#16171a') : lit ? '#ffd9a8' : '#eceae2'
      ctx.beginPath()
      ctx.roundRect(kx + 1, ky, kw - 2, kh, 3)
      ctx.fill()
      if (!k.black) {
        ctx.strokeStyle = '#9a9890'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  })

  const handlePad = (key: string) => {
    if (key === '♪') sendSurface(mod, 'num', calc.current.value(), 0, true)
    else if (key === 'ADSR') {
      // the display becomes the ADSR sound's code
      const code = Math.min(99999999, Math.max(0, Math.round(Math.abs(calc.current.value()))))
      actions.setParams([[mod, 'code', code], [mod, 'sound', ADSR_SOUND]], `tally:${mod}:adsr`)
    } else calc.current.press(key)
  }

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const el = e.currentTarget
    const at = (ev: { clientX: number; clientY: number }) => {
      const b = el.getBoundingClientRect()
      return [(ev.clientX - b.left) / b.width, (ev.clientY - b.top) / b.height] as const
    }
    const [fx, fy] = at(e)
    if (inside(ONE_KEY, fx, fy)) {
      down.current.ok = true
      sendSurface(mod, 'ok', 0, 0, true)
      track(
        () => {},
        () => {
          down.current.ok = false
          sendSurface(mod, 'ok', 0, 0, false)
        },
      )
      return
    }
    if (inside(RHYTHM_BTN, fx, fy)) {
      actions.setParam(mod, 'run', (live().run ?? 0) >= 0.5 ? 0 : 1)
      return
    }
    const pad = padRects().find((q) => inside(q.r, fx, fy))
    if (pad) {
      down.current.pad = pad.key
      handlePad(pad.key)
      track(
        () => {},
        () => (down.current.pad = undefined),
      )
      return
    }
    const key = keyAt(fx, fy)
    if (key === null) return
    // the strip: slide across it for a glissando
    down.current.key = key
    sendSurface(mod, 'key', key, 0, true)
    track(
      (ev) => {
        const [mx, my] = at(ev)
        const next = keyAt(mx, my)
        if (next === null || next === down.current.key) return
        sendSurface(mod, 'key', down.current.key!, 0, false)
        down.current.key = next
        sendSurface(mod, 'key', next, 0, true)
      },
      () => {
        if (down.current.key !== undefined) sendSurface(mod, 'key', down.current.key, 0, false)
        down.current.key = undefined
      },
    )
  }

  return (
    <canvas
      ref={ref}
      className="surface-canvas"
      width={W}
      height={H}
      style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, cursor: 'pointer' }}
      onPointerDown={onDown}
    />
  )
}
