import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { SPECS } from '../../modules'
import { hpOf } from '../../modules/size'
import { railHp } from '../../patch/layout'
import { actions, patchStore } from '../../patch/store'
import type { ModuleInst } from '../../patch/types'
import { HP_PX, ROW_PX, SIDE, moduleLeft, nearestJack, rackHeight, rackWidth, rowTop } from '../geometry'
import { familyOf, jackInfo } from '../../modules/jackInfo'
import { ModulePanel } from '../panel/ModulePanel'
import { useSettings } from '../settings'
import { CableLayer } from './CableLayer'
import { ContextMenu } from './ContextMenu'
import { JackMenu } from './JackMenu'
import { JackReadout } from './JackReadout'
import { ControlReadout } from './ControlReadout'
import { RemoveRowDialog, RowMenu, type RowMenuState } from './RowMenu'
import { rackView } from './rackView'
import { libraryPreview, placementOf } from './dragPreview'
import { libraryDrag } from './libraryDrag'
import { useRackInteractions } from './useRackInteractions'
import { useLightShow } from './lightShow'
import { TutorialHighlight } from '../tutorial/TutorialHighlight'

export function Rack() {
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get)
  const lib = useSyncExternalStore(libraryDrag.subscribe, libraryDrag.get)
  const { zoom: zoomSetting, cableOpacity, jackHints } = useSettings()
  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const rail = railHp(patch)
  const fitZoom = useFitZoom(scrollRef, rail)
  const zoom = zoomSetting ?? fitZoom
  useLightShow(innerRef)

  const toLocal = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = innerRef.current!.getBoundingClientRect()
      return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }
    },
    [zoom],
  )
  const { cable, move, menu, setMenu, jackMenu, setJackMenu, handlers } = useRackInteractions(toLocal)
  const closeJackMenu = useCallback(() => setJackMenu(null), [setJackMenu])
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null)
  const closeRowMenu = useCallback(() => setRowMenu(null), [])
  const [removing, setRemoving] = useState<number | null>(null)
  const closeRemoving = useCallback(() => setRemoving(null), [])

  const libPreview = useMemo(
    () => (lib ? libraryPreview(lib.type, toLocal(lib), patch) : null),
    [lib, patch, toLocal],
  )
  const preview = move ?? libPreview
  const place = useCallback((m: ModuleInst) => placementOf(m, preview), [preview])
  // which inputs already hold a cable, per module (for the patching hints)
  const fed = useMemo(() => {
    const by: Record<string, string[]> = {}
    for (const c of patch.cables) (by[c.to.mod] ??= []).push(c.to.jack)
    return by
  }, [patch.cables])

  // patching hints: the dragged jack's signal family, and the jack the cable would land on
  const anchorMod = cable ? patch.modules.find((m) => m.id === cable.anchor.mod) : undefined
  const dragFamily = cable && anchorMod ? familyOf(jackInfo(SPECS[anchorMod.type], cable.anchor.jack, cable.anchorDir).signal) : ''
  const hit = cable && jackHints ? nearestJack(patch, cable, 16) : null
  const target = hit && hit.dir !== cable!.anchorDir ? hit : null
  const targetMod = target ? patch.modules.find((m) => m.id === target.mod) : undefined
  const targetName = target && targetMod ? `${SPECS[targetMod.type].title} · ${jackInfo(SPECS[targetMod.type], target.jack, target.dir).label}` : ''

  // Others (a rig just added from the library) can bring a row into view.
  useEffect(() => {
    rackView.reveal = (row) => scrollRef.current?.scrollTo({ top: Math.max(0, rowTop(row) * zoom - 12), behavior: 'smooth' })
  }, [zoom])

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
  const W = rackWidth(rail)
  const H = rackHeight(rows)
  return (
    <div className="rack-scroll" ref={scrollRef}>
      <div className="rack-sizer" style={{ width: W * zoom, height: H * zoom }}>
        <div
          className={cable && jackHints ? `rack hint-from-${cable.anchorDir} hint-fam-${dragFamily}` : 'rack'}
          ref={innerRef}
          style={{ width: W, height: H, transform: `scale(${zoom})` }}
        >
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={r}
              className={r >= patch.rows ? 'case-row new' : 'case-row'}
              style={{ left: SIDE, top: rowTop(r), width: rail * HP_PX, height: ROW_PX }}
              onContextMenu={(e) => {
                // empty rail: the row's own menu (modules have theirs)
                e.preventDefault()
                if (r >= patch.rows) return
                setMenu(null)
                setRowMenu({ row: r, x: e.clientX, y: e.clientY })
              }}
            >
              <div className="rail top" />
              <div className="rail bottom" />
              {r >= patch.rows && <div className="new-row-hint">drop here for a new row</div>}
            </div>
          ))}
          {patch.modules.map((m) => {
            const at = place(m)
            return (
              <ModulePanel key={m.id} inst={m} row={at.row} hp={at.hp} lifted={move?.id === m.id} handlers={handlers} fed={fed[m.id]?.join(',') ?? ''} />
            )
          })}
          {move?.free && (
            // where the held panel will drop
            <div
              className="move-ghost"
              style={{ left: moduleLeft(move.hp), top: rowTop(move.row), width: hpOf(patch.modules.find((m) => m.id === move.id) ?? { type: move.type }) * HP_PX, height: ROW_PX }}
            />
          )}
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
          {target && (
            <div className="jack-target" style={{ left: target.x, top: target.y }}>
              <span>{targetName}</span>
            </div>
          )}
          <TutorialHighlight width={W} height={H} />
        </div>
      </div>
      {lib && (
        <div className="drag-chip" style={{ left: lib.clientX + 12, top: lib.clientY + 12 }}>
          {SPECS[lib.type].name} · {SPECS[lib.type].hp} HP
        </div>
      )}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {jackMenu && <JackMenu menu={jackMenu} onClose={closeJackMenu} />}
      {rowMenu && <RowMenu menu={rowMenu} onClose={closeRowMenu} onAsk={setRemoving} />}
      {removing !== null && <RemoveRowDialog row={removing} onClose={closeRemoving} />}
      {!cable && !move && <JackReadout />}
      {!cable && !move && <ControlReadout />}
    </div>
  )
}

/** Zoom that fits the full rail width into the visible area. */
function useFitZoom(ref: React.RefObject<HTMLDivElement | null>, rail: number): number {
  const [z, setZ] = useState(0.8)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setZ(Math.max(0.2, Math.min(1.5, (el.clientWidth - 24) / rackWidth(rail))))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, rail])
  return z
}
