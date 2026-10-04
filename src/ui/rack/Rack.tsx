import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { SPECS } from '../../modules'
import { ROW_HP } from '../../patch/layout'
import { actions, patchStore } from '../../patch/store'
import type { ModuleInst } from '../../patch/types'
import { HP_PX, ROW_PX, SIDE, moduleLeft, rackHeight, rackWidth, rowTop } from '../geometry'
import { ModulePanel } from '../panel/ModulePanel'
import { useSettings } from '../settings'
import { CableLayer } from './CableLayer'
import { ContextMenu } from './ContextMenu'
import { JackMenu } from './JackMenu'
import { JackReadout } from './JackReadout'
import { libraryPreview, placementOf } from './dragPreview'
import { libraryDrag } from './libraryDrag'
import { useRackInteractions } from './useRackInteractions'

export function Rack() {
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get)
  const lib = useSyncExternalStore(libraryDrag.subscribe, libraryDrag.get)
  const { zoom: zoomSetting, cableOpacity } = useSettings()
  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const fitZoom = useFitZoom(scrollRef)
  const zoom = zoomSetting ?? fitZoom

  const toLocal = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = innerRef.current!.getBoundingClientRect()
      return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }
    },
    [zoom],
  )
  const { cable, move, menu, setMenu, jackMenu, setJackMenu, handlers } = useRackInteractions(toLocal)
  const closeJackMenu = useCallback(() => setJackMenu(null), [setJackMenu])

  const libPreview = useMemo(
    () => (lib ? libraryPreview(lib.type, toLocal(lib), patch) : null),
    [lib, patch, toLocal],
  )
  const preview = move ?? libPreview
  const place = useCallback((m: ModuleInst) => placementOf(m, preview), [preview])

  // Library drops land wherever the preview showed them.
  useEffect(() => {
    libraryDrag.onDrop = (d) => {
      const pv = libraryPreview(d.type, toLocal(d), patchStore.get())
      return !!pv && actions.insertModule(d.type, pv.row, pv.targetHp) !== null
    }
    return () => {
      libraryDrag.onDrop = null
    }
  }, [toLocal])

  const dragging = !!move || !!lib
  const rows = patch.rows + (dragging ? 1 : 0) // a spare row to drop into
  const W = rackWidth()
  const H = rackHeight(rows)
  return (
    <div className="rack-scroll" ref={scrollRef}>
      <div className="rack-sizer" style={{ width: W * zoom, height: H * zoom }}>
        <div className="rack" ref={innerRef} style={{ width: W, height: H, transform: `scale(${zoom})` }}>
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={r}
              className={r >= patch.rows ? 'case-row new' : 'case-row'}
              style={{ left: SIDE, top: rowTop(r), width: ROW_HP * HP_PX, height: ROW_PX }}
            >
              <div className="rail top" />
              <div className="rail bottom" />
              {r >= patch.rows && <div className="new-row-hint">drop here for a new row</div>}
            </div>
          ))}
          {patch.modules.map((m) => {
            const at = place(m)
            return <ModulePanel key={m.id} inst={m} row={at.row} hp={at.hp} lifted={move?.id === m.id} handlers={handlers} />
          })}
          {libPreview && (
            <div
              className="drop-ghost"
              style={{
                left: moduleLeft(libPreview.hp),
                top: rowTop(libPreview.row),
                width: SPECS[libPreview.type].hp * HP_PX,
                height: ROW_PX,
              }}
            >
              {SPECS[libPreview.type].title}
            </div>
          )}
          <CableLayer patch={patch} place={place} drag={cable} opacity={cableOpacity} width={W} height={H} />
        </div>
      </div>
      {lib && (
        <div className="drag-chip" style={{ left: lib.clientX + 12, top: lib.clientY + 12 }}>
          {SPECS[lib.type].name} · {SPECS[lib.type].hp} HP
        </div>
      )}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {jackMenu && <JackMenu menu={jackMenu} onClose={closeJackMenu} />}
      {!cable && !move && <JackReadout />}
    </div>
  )
}

/** Zoom that fits the full 104 HP row width into the visible area. */
function useFitZoom(ref: React.RefObject<HTMLDivElement | null>): number {
  const [z, setZ] = useState(0.8)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setZ(Math.max(0.3, Math.min(1.5, (el.clientWidth - 24) / rackWidth())))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return z
}
