import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { buffers } from '../audio/buffers'
import { exportRack, unpack } from '../patch/bundle'
import { RAIL_SIZES, railHp, usedHp } from '../patch/layout'
import { actions, patchStore } from '../patch/store'
import { settings, useSettings } from './settings'

/** The ☰ menu: everything you set once or reach for now and then (files,
 *  the case's size, view, hints and the analog realism), so the top bar keeps
 *  only what you use while playing. */
export function AppMenu() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get)
  const s = useSettings()

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  // a .voltage file carries the recordings too; older .json patch files still import
  const importFile = async (f: File | undefined) => {
    if (!f) return
    const b = await unpack(new Uint8Array(await f.arrayBuffer()))
    if (!b) return alert('That isn’t a VOLTAGE file.')
    buffers.adopt(b.recordings)
    actions.load(b.patch)
    setOpen(false)
  }
  const run = (fn: () => void) => () => {
    fn()
    setOpen(false)
  }

  return (
    <div className="app-menu" ref={root}>
      <button className={open ? 'menu-btn active' : 'menu-btn'} onClick={() => setOpen((o) => !o)} title="Menu: files, the rack’s size, view and settings" aria-label="Menu">
        ☰
      </button>
      {open && (
        <div className="app-menu-panel">
          <section>
            <h4>Rack</h4>
            <button onClick={run(actions.clear)}>New empty rack <kbd>Ctrl+Z undoes</kbd></button>
            <button onClick={() => fileRef.current?.click()}>Open a file…</button>
            <button onClick={run(() => void exportRack(patchStore.get()))}>Save as a file (.voltage, with recordings)</button>
          </section>
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
      <input
        ref={fileRef}
        type="file"
        accept=".voltage,application/json,.json"
        hidden
        onChange={(e) => {
          void importFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
