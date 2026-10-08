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
import { holdForTip } from './touchHold'

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

    /** Pick up a cable from a jack (a patched input gives up its plug). */
    const fromJack = (mod: string, jack: string, dir: 'in' | 'out', e: ClientPt) => {
      if (dir === 'in') {
        const c = patchStore.get().cables.find((c) => c.to.mod === mod && c.to.jack === jack)
        if (c) {
          actions.removeCable(c.id)
          startCable(c.from, 'out', c.color, e, c)
          return
        }
      }
      startCable({ mod, jack }, dir, nextColor(), e)
    }

    return {
      jackDown(mod, jack, dir, e) {
        if (e.button !== 0) return
        // a finger: the cable comes once it moves; held still, the jack's tooltip
        if (e.pointerType === 'touch') {
          holdForTip(
            e,
            () => jackHover.set({ mod, jack, dir, x: e.clientX, y: e.clientY - 40 }),
            () => jackHover.set(null),
            (ev) => fromJack(mod, jack, dir, ev),
          )
          return
        }
        fromJack(mod, jack, dir, e)
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
        // the panel follows the pointer every frame; the slot (and neighbours) only on a new slot
        let frame = 0
        let free = { x: moduleLeft(m.hp), y: rowTop(m.row) }
        const draw = () => {
          frame = 0
          setMove({ ...cur, free })
        }
        track(
          (ev) => {
            // a press that barely moves is a click, not a move
            if (!lifted) {
              if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < slop) return
              lifted = true
            }
            const pt = local.current(ev)
            free = { x: pt.x - dx, y: pt.y - dy }
            const t = slotAt(pt, dx, dy, base.rows)
            const key = `${t.row}:${t.hp}`
            if (key !== last) {
              last = key
              const pv = resolve(base, id, m.type, t.row, t.hp)
              if (pv) cur = pv
            }
            if (!frame) frame = requestAnimationFrame(draw)
          },
          () => {
            if (frame) cancelAnimationFrame(frame)
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
