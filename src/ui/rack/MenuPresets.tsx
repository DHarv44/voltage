import { useState } from 'react'
import { modulePresets, useModulePresets } from '../../patch/modulePresets'
import { actions, patchStore } from '../../patch/store'
import type { ModuleInst } from '../../patch/types'

/** The right-click menu's presets: this module's settings saved under a name,
 *  then loaded onto any module of its type (one undo step). */
export function MenuPresets({ m, onDone }: { m: ModuleInst; onDone: () => void }) {
  const list = useModulePresets(m.type)
  const [name, setName] = useState('')
  const save = () => {
    const live = patchStore.get().modules.find((x) => x.id === m.id) ?? m
    modulePresets.save(m.type, name || `Preset ${list.length + 1}`, live.params)
    setName('')
  }
  return (
    <div className="ctx-presets">
      <span>Presets</span>
      {list.map((p) => (
        <div key={p.name} className="ctx-preset">
          <button
            onClick={() => {
              const v = modulePresets.values(m.type, p)
              actions.setParams(
                Object.entries(v).map(([id, x]): [string, string, number] => [m.id, id, x]),
                `preset-${m.id}-${Date.now()}`,
              )
              onDone()
            }}
            title="Load these settings onto this module"
          >
            {p.name}
          </button>
          <button className="ctx-preset-x" onClick={() => modulePresets.remove(m.type, p.name)} title="Delete this preset">
            ×
          </button>
        </div>
      ))}
      <form
        className="ctx-preset-save"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input value={name} maxLength={40} placeholder="Name this sound" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        <button type="submit">Save</button>
      </form>
    </div>
  )
}
