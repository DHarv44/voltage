import { useEffect } from 'react'
import { SPECS } from '../../modules'
import { hpOf } from '../../modules/size'
import { actions, patchStore } from '../../patch/store'
import { BUFFER_SLOTS, buffers } from '../../audio/buffers'
import type { MenuState } from './useRackInteractions'

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose()
    const t = window.setTimeout(() => window.addEventListener('pointerdown', close), 0)
    window.addEventListener('keydown', close)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [onClose])

  const m = patchStore.get().modules.find((x) => x.id === menu.id)
  if (!m) return null
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }
  return (
    <div className="ctx-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ctx-title">{SPECS[m.type].name}</div>
      <button onClick={run(() => actions.addModule(m.type, { ...m.params }))}>Duplicate</button>
      <button onClick={run(() => actions.resetParams(m.id))}>Reset knobs</button>
      {SPECS[m.type].sizes && (
        <div className="ctx-sizes">
          <span>Size</span>
          {SPECS[m.type].sizes!.map((hp) => (
            <button
              key={hp}
              className={hpOf(m) === hp ? 'on' : ''}
              onClick={run(() => {
                if (!actions.setWidth(m.id, hp)) alert(`No room for ${hp} HP in this row: make space first, or move it to another row.`)
              })}
            >
              {hp} HP
            </button>
          ))}
        </div>
      )}
      {BUFFER_SLOTS[m.type] && (
        <button
          onClick={run(async () => {
            let saved = 0
            for (let s = 0; s < BUFFER_SLOTS[m.type]; s++) {
              const name = BUFFER_SLOTS[m.type] > 1 ? `${SPECS[m.type].title}-slot${s + 1}` : SPECS[m.type].title
              if (await buffers.exportWav(m.id, s, name.toLowerCase())) saved++
            }
            if (!saved) alert('Nothing to export: record something first (and make sure the rack power is on).')
          })}
        >
          Export audio (WAV)
        </button>
      )}
      <button className="danger" onClick={run(() => actions.removeModule(m.id))}>
        Remove module
      </button>
    </div>
  )
}
