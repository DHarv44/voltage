import { useMemo, useRef, useState } from 'react'
import { nextColor } from '../../patch/factory'
import { actions, patchStore } from '../../patch/store'
import type { Cable, JackRef } from '../../patch/types'
import type { JackMenuState } from './JackMenu'
import { jackHover } from './jackHover'
import { moduleLeft, nearestJack, rowTop, type Pt } from '../geometry'
import type { PanelHandlers } from '../panel/ModulePanel'
import { track } from '../pointer'
import { resolve, slotAt, type DragPreview } from './dragPreview'

export interface CableDrag extends Pt {
  anchor: JackRef
  anchorDir: 'in' | 'out'
  color: string
}

export interface MenuState {
  id: string
  x: number
  y: number
}

type ClientPt = { clientX: number; clientY: number }

/** How far (px) a press must travel before the panel lifts: a mouse, then a
 *  finger or pen (they wobble more). */
const MOVE_SLOP = 6
const MOVE_SLOP_TOUCH = 12

/** Panels move only by their bare face: the panel itself, its printed text
 *  (title, labels) or the empty SVG. Anything else under the pointer is a
 *  control (knob, jack, switch, screen, surface…), and pressing a control
 *  never moves the module, even if the control lets the press through. */
function grabbable(target: EventTarget, panel: EventTarget): boolean {
  if (target === panel) return true
  if (!(target instanceof Element)) return false
  if (target instanceof SVGSVGElement && target.parentElement === panel) return true
  return target instanceof SVGTextElement && target.classList.contains('silk')
}

/** Cable patching (drag from any jack; grabbing a patched input pulls that plug),
 *  module dragging (only the dragged panel moves; neighbours slide aside on drop),
 *  and the module context menu. */
export function useRackInteractions(toLocal: (e: ClientPt) => Pt) {
  const [cable, setCable] = useState<CableDrag | null>(null)
  const [move, setMove] = useState<DragPreview | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [jackMenu, setJackMenu] = useState<JackMenuState | null>(null)
  const local = useRef(toLocal)
  local.current = toLocal

  const handlers = useMemo<PanelHandlers>(() => {
    /** `picked` = the cable lifted out of an input, restored if the drag is cancelled. */
    const startCable = (anchor: JackRef, anchorDir: 'in' | 'out', color: string, e: ClientPt, picked?: Cable) => {
      setCable({ anchor, anchorDir, color, ...local.current(e) })
      const stopEsc = () => window.removeEventListener('keydown', onKey)
      const detach = track(
        (ev) => {
          const pt = local.current(ev)
          setCable((c) => c && { ...c, ...pt })
        },
        (ev) => {
          stopEsc()
          const hit = nearestJack(patchStore.get(), local.current(ev), 16)
          if (hit && hit.dir !== anchorDir) actions.connect({ ...anchor, dir: anchorDir }, hit, color)
          setCable(null)
        },
      )
      // Esc cancels the drag; a cable lifted from an input goes back where it was.
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape') return
        detach()
        stopEsc()
        if (picked) actions.restoreCable(picked)
        setCable(null)
      }
      window.addEventListener('keydown', onKey)
    }

    return {
      jackDown(mod, jack, dir, e) {
        if (e.button !== 0) return
        if (dir === 'in') {
          const c = patchStore.get().cables.find((c) => c.to.mod === mod && c.to.jack === jack)
          if (c) {
            actions.removeCable(c.id)
            startCable(c.from, 'out', c.color, e, c)
            return
          }
        }
        startCable({ mod, jack }, dir, nextColor(), e)
      },
      // Right-click pulls the jack's cables; Shift+right-click (or an empty jack) opens the jack menu.
      jackContext(mod, jack, dir, e) {
        const at = (r: { mod: string; jack: string }) => r.mod === mod && r.jack === jack
        const plugged = patchStore.get().cables.some((c) => at(dir === 'in' ? c.to : c.from))
        if (plugged && !e.shiftKey) actions.removeCablesAt(mod, jack)
        else setJackMenu({ mod, jack, dir, x: e.clientX, y: e.clientY })
      },
      jackHover(mod, jack, dir, e) {
        jackHover.set(e ? { mod, jack, dir, x: e.clientX, y: e.clientY } : null)
      },
      panelDown(id, e) {
        if (e.button !== 0 || !grabbable(e.target, e.currentTarget)) return
        const base = patchStore.get() // neighbours slide relative to where they were at grab time
        const m = base.modules.find((x) => x.id === id)
        if (!m) return
        const grab = local.current(e)
        const dx = grab.x - moduleLeft(m.hp)
        const dy = grab.y - rowTop(m.row)
        let cur: DragPreview = { id, type: m.type, row: m.row, hp: m.hp, targetHp: m.hp, moves: {} }
        let last = ''
        let lifted = false
        const sx = e.clientX
        const sy = e.clientY
        const slop = e.pointerType === 'mouse' ? MOVE_SLOP : MOVE_SLOP_TOUCH
        track(
          (ev) => {
            // a press that barely moves is a click, not a move
            if (!lifted) {
              if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < slop) return
              lifted = true
              setMove(cur)
            }
            const t = slotAt(local.current(ev), dx, dy, base.rows)
            const key = `${t.row}:${t.hp}`
            if (key === last) return
            last = key
            const pv = resolve(base, id, m.type, t.row, t.hp)
            if (pv) {
              cur = pv
              setMove(pv)
            }
          },
          () => {
            if (!lifted) return
            const moved = cur.row !== m.row || cur.hp !== m.hp || Object.keys(cur.moves).length > 0
            if (moved) actions.placeModule(id, cur.row, cur.targetHp)
            setMove(null)
          },
        )
      },
      panelContext(id, e) {
        e.preventDefault()
        setMenu({ id, x: e.clientX, y: e.clientY })
      },
    }
  }, [])

  return { cable, move, menu, setMenu, jackMenu, setJackMenu, handlers }
}
