import { useEffect, useSyncExternalStore } from 'react'
import { SPECS } from '../../modules'
import { CABLE_COLORS } from '../../patch/factory'
import { actions, patchStore } from '../../patch/store'
import type { JackRef } from '../../patch/types'

export interface JackMenuState extends JackRef {
  dir: 'in' | 'out'
  x: number
  y: number
}

const jackName = (ref: JackRef, dir: 'in' | 'out') => {
  const m = patchStore.get().modules.find((x) => x.id === ref.mod)
  if (!m) return '?'
  const spec = SPECS[m.type]
  const j = (dir === 'in' ? spec.inputs : spec.outputs).find((x) => x.id === ref.jack)
  return `${spec.title} ${j?.label || ref.jack}`
}

/** Shift+right-click on a jack: recolour or pull each cable plugged into it. */
export function JackMenu({ menu, onClose }: { menu: JackMenuState; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => window.addEventListener('pointerdown', onClose), 0)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', onClose)
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])

  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get) // live after recolour/remove
  const at = (r: JackRef) => r.mod === menu.mod && r.jack === menu.jack
  const cables = patch.cables.filter((c) => (menu.dir === 'out' ? at(c.from) : at(c.to)))

  return (
    <div className="ctx-menu jack-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ctx-title">{jackName(menu, menu.dir)}</div>
      {cables.length === 0 && <div className="jm-empty">Nothing patched here</div>}
      {cables.map((c) => (
        <div key={c.id} className="jm-cable">
          <div className="jm-label">
            <span className="jm-dot" style={{ background: c.color }} />
            {menu.dir === 'out' ? `→ ${jackName(c.to, 'in')}` : `← ${jackName(c.from, 'out')}`}
            <button className="jm-x" title="Pull this cable" onClick={() => actions.removeCable(c.id)}>
              ✕
            </button>
          </div>
          <div className="jm-swatches">
            {CABLE_COLORS.map((col) => (
              <button
                key={col}
                className={col === c.color ? 'jm-swatch on' : 'jm-swatch'}
                style={{ background: col }}
                title="Recolour"
                onClick={() => actions.recolorCable(c.id, col)}
              />
            ))}
          </div>
        </div>
      ))}
      {cables.length > 1 && (
        <button
          className="danger"
          onClick={() => {
            actions.removeCablesAt(menu.mod, menu.jack)
            onClose()
          }}
        >
          Pull all cables
        </button>
      )}
    </div>
  )
}
