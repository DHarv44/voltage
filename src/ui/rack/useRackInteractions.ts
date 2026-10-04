import { useMemo, useRef, useState } from 'react'
import { nextColor } from '../../patch/factory'
import { actions, patchStore } from '../../patch/store'
import type { JackRef } from '../../patch/types'
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

/** Cable patching (drag from any jack; grabbing a patched input pulls that plug),
 *  module dragging (only the dragged panel moves; neighbours slide aside on drop),
 *  and the module context menu. */
export function useRackInteractions(toLocal: (e: ClientPt) => Pt) {
  const [cable, setCable] = useState<CableDrag | null>(null)
  const [move, setMove] = useState<DragPreview | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const local = useRef(toLocal)
  local.current = toLocal

  const handlers = useMemo<PanelHandlers>(() => {
    const startCable = (anchor: JackRef, anchorDir: 'in' | 'out', color: string, e: ClientPt) => {
      setCable({ anchor, anchorDir, color, ...local.current(e) })
      track(
        (ev) => {
          const pt = local.current(ev)
          setCable((c) => c && { ...c, ...pt })
        },
        (ev) => {
          const hit = nearestJack(patchStore.get(), local.current(ev), 16)
          if (hit && hit.dir !== anchorDir) actions.connect({ ...anchor, dir: anchorDir }, hit, color)
          setCable(null)
        },
      )
    }

    return {
      jackDown(mod, jack, dir, e) {
        if (e.button !== 0) return
        if (dir === 'in') {
          const c = patchStore.get().cables.find((c) => c.to.mod === mod && c.to.jack === jack)
          if (c) {
            actions.removeCable(c.id)
            startCable(c.from, 'out', c.color, e)
            return
          }
        }
        startCable({ mod, jack }, dir, nextColor(), e)
      },
      jackContext(mod, jack) {
        actions.removeCablesAt(mod, jack)
      },
      panelDown(id, e) {
        if (e.button !== 0) return
        const base = patchStore.get() // neighbours slide relative to where they were at grab time
        const m = base.modules.find((x) => x.id === id)
        if (!m) return
        const grab = local.current(e)
        const dx = grab.x - moduleLeft(m.hp)
        const dy = grab.y - rowTop(m.row)
        let cur: DragPreview = { id, type: m.type, row: m.row, hp: m.hp, targetHp: m.hp, moves: {} }
        let last = ''
        setMove(cur)
        track(
          (ev) => {
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

  return { cable, move, menu, setMenu, handlers }
}
