import { useState, useSyncExternalStore } from 'react'
import { RAIL_SIZES, railHp, usedHp } from '../patch/layout'
import { actions, patchStore } from '../patch/store'
import { DeviceModal } from './cloud/DeviceModal'
import { perform } from './perform'
import { settings, useSettings } from './settings'
import { usePopover } from './usePopover'

/** The ☰ menu: what you set once or reach for now and then (the case's size,
 *  view, hints, your racks on other devices, the analog realism), so the top
 *  bar keeps only what you use while playing. The rack's own things (files,
 *  copies, My racks) are in its name's menu. */
export function AppMenu() {
  const { open, setOpen, toggle, root } = usePopover()
  const [devices, setDevices] = useState(false)
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get)
  const s = useSettings()
  const run = (fn: () => void) => () => {
    fn()
    setOpen(false)
  }

  return (
    <div className="app-menu" ref={root}>
      <button className={open ? 'menu-btn active' : 'menu-btn'} onClick={toggle} title="Menu: the case’s size, view, hints and settings" aria-label="Menu">
        ☰
      </button>
      {open && (
        <div className="app-menu-panel">
          <section>
            <h4>Case</h4>
            <div className="app-row">
              <span>Rows</span>
              <button className="mini" onClick={actions.removeRow} title="Remove the bottom row (if it’s empty)">
                −
              </button>
              <b>{patch.rows}</b>
              <button className="mini" onClick={actions.addRow} title="Add a row at the bottom">
                +
              </button>
            </div>
            <label className="app-row">
              <span>Width</span>
              <select
                value={railHp(patch)}
                onChange={(e) => {
                  if (!actions.setRail(Number(e.target.value))) alert('Some modules sit beyond that width: move them in first.')
                }}
              >
                {RAIL_SIZES.map((hp) => (
                  <option key={hp} value={hp} disabled={hp < usedHp(patch)}>
                    {hp} HP
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section>
            <h4>View</h4>
            <label className="app-row">
              <span>Zoom</span>
              <input type="range" min={0.3} max={1.5} step={0.05} value={s.zoom ?? 0.8} onChange={(e) => settings.set({ zoom: Number(e.target.value) })} />
              <button className={s.zoom === null ? 'mini active' : 'mini'} onClick={() => settings.set({ zoom: null })} title="Fit the rack to the window">
                Fit
              </button>
            </label>
            <button className="app-wide" onClick={run(() => perform.set(true))}>
              Performance mode: just the rack <kbd>` · Esc leaves</kbd>
            </button>
            <label className="app-row">
              <span>Cables</span>
              <input type="range" min={0.15} max={1} step={0.05} value={s.cableOpacity} onChange={(e) => settings.set({ cableOpacity: Number(e.target.value) })} />
            </label>
          </section>
          <section>
            <h4>Help while patching</h4>
            <label className="app-check">
              <input type="checkbox" checked={s.jackHints} onChange={(e) => settings.set({ jackHints: e.target.checked })} />
              <span>
                <b>Jack hints</b> While you drag a cable, light up every jack it could go to.
              </span>
            </label>
            <label className="app-check">
              <input type="checkbox" checked={s.explain} onChange={(e) => settings.set({ explain: e.target.checked })} />
              <span>
                <b>Explanations</b> Plain words in the tooltips: what a jack carries, what a knob does.
              </span>
            </label>
          </section>
          <section>
            <h4>Online</h4>
            <button onClick={run(() => setDevices(true))}>Your racks on other devices…</button>
          </section>
          <section>
            <h4>Analog realism</h4>
            <label className="app-check">
              <input type="checkbox" checked={s.psuSag} onChange={(e) => settings.set({ psuSag: e.target.checked })} />
              <span>
                <b>Power supply sag</b> A busy rack loads the supply: outputs clip a little sooner, oscillators drift slightly flat.
              </span>
            </label>
            <label className="app-check">
              <input type="checkbox" checked={s.crosstalk} onChange={(e) => settings.set({ crosstalk: e.target.checked })} />
              <span>
                <b>Crosstalk</b> A faint bleed between neighbouring jacks, as on real hardware.
              </span>
            </label>
          </section>
        </div>
      )}
      {devices && <DeviceModal onClose={() => setDevices(false)} />}
    </div>
  )
}
