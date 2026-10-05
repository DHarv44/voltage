import { useSyncExternalStore } from 'react'
import { SPECS } from '../../modules'
import { actions, patchStore } from '../../patch/store'
import type { ModuleInst } from '../../patch/types'

/** Where a module's menu settings live: its own, or (a VISION VIEW) those of
 *  the tank its LINK input is patched from. */
export function settingsHost(m: ModuleInst): ModuleInst | undefined {
  if (SPECS[m.type].settings) return m
  const p = patchStore.get()
  const c = p.cables.find((k) => k.to.mod === m.id && k.to.jack === 'link')
  const src = c && c.from.jack === 'link' ? p.modules.find((x) => x.id === c.from.mod) : undefined
  return src && SPECS[src.type].settings ? src : undefined
}

/** The right-click menu's settings rows: each stepped param the spec lists
 *  under `settings`, as a row of options (the current one lit). Choosing one
 *  keeps the menu open, so you can try a few. */
export function MenuSettings({ host, own }: { host: ModuleInst; own: boolean }) {
  const spec = SPECS[host.type]
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get) // lit option follows the click
  const live = patch.modules.find((x) => x.id === host.id) ?? host
  return (
    <>
      {!own && <div className="ctx-note">Settings of the linked {spec.title}</div>}
      {spec.settings!.map((id) => {
        const ps = spec.params.find((p) => p.id === id)
        if (!ps?.options) return null
        const cur = Math.round(live.params[id] ?? ps.def)
        return (
          <div key={id} className="ctx-setting">
            <span>{ps.label}</span>
            <div>
              {ps.options.map((name, i) => (
                <button key={name} className={cur === i + ps.min ? 'on' : ''} onClick={() => actions.setParam(host.id, id, i + ps.min)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}
