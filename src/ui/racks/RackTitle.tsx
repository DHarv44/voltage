import { useRef, useState } from 'react'
import { buffers } from '../../audio/buffers'
import { useCloudCurrent } from '../../cloud/current'
import { exportRack, unpack } from '../../patch/bundle'
import { patchLibrary } from '../../patch/library'
import { SCRATCH } from '../../patch/persist'
import { rackName, useRackName } from '../../patch/rackName'
import { actions, patchStore } from '../../patch/store'
import { toast } from '../Toast'
import { usePopover } from '../usePopover'
import { MyRacks } from './MyRacks'

/** The rack's name in the top bar, with where it's kept (saved here, online,
 *  or a sandbox), and its menu: rename, My racks, a copy, files, new. */
export function RackTitle() {
  const name = useRackName()
  const cloud = useCloudCurrent()
  const pop = usePopover()
  const [racks, setRacks] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = (fn: () => void) => () => {
    fn()
    pop.setOpen(false)
  }
  const rename = () => {
    const n = prompt('Call this rack:', name)?.trim()
    if (n) rackName.set(n)
  }
  const copy = () => {
    let n = name
    for (let k = 2; patchLibrary.has(n); k++) n = `${name} (${k})`
    if (patchLibrary.save(n, structuredClone(patchStore.get()))) toast.show('Saved a copy', `“${n}” is in My racks.`)
    else alert('Couldn’t save: this browser’s storage is full or blocked.')
  }
  const importFile = async (f: File | undefined) => {
    if (!f) return
    const b = await unpack(new Uint8Array(await f.arrayBuffer()))
    if (!b) return alert('That isn’t a VOLTAGE file.')
    buffers.adopt(b.recordings)
    actions.load(b.patch)
    rackName.set(b.title || f.name.replace(/\.(voltage|json)$/, ''))
  }

  const where = SCRATCH ? (name === 'Sandbox' ? 'not saved' : 'Sandbox · not saved') : cloud ? '✓ Saved · online too' : '✓ Saved in this browser'
  return (
    <div className="rack-title" ref={pop.root}>
      <button className={pop.open ? 'rack-name active' : 'rack-name'} onClick={pop.toggle} title="This rack: rename it, open your other racks, save a copy or a file">
        <b>{name}</b>
        <span className={SCRATCH ? 'rack-where sandbox' : 'rack-where'}>{where}</span>
        <i>▾</i>
      </button>
      {pop.open && (
        <div className="app-menu-panel rack-menu">
          <section>
            <button onClick={run(rename)}>Rename…</button>
            <button onClick={run(() => setRacks(true))}>My racks…</button>
            <button onClick={run(copy)}>Save a copy to My racks</button>
          </section>
          <section>
            <button onClick={run(() => fileRef.current?.click())}>Open a file…</button>
            <button onClick={run(() => void exportRack(patchStore.get(), name.replace(/[^\w -]+/g, '').trim() || 'voltage-rack'))}>Save as a file (with recordings)</button>
          </section>
          <section>
            <button onClick={run(() => (actions.clear(), rackName.set('')))}>
              New empty rack <kbd>Ctrl+Z undoes</kbd>
            </button>
            {SCRATCH && <button onClick={run(() => (location.href = `${location.origin}/`))}>Back to my own rack</button>}
          </section>
        </div>
      )}
      {racks && <MyRacks onClose={() => setRacks(false)} />}
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
