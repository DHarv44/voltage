import { useState } from 'react'
import { useLibrary, patchLibrary } from '../../patch/library'
import { rackName } from '../../patch/rackName'
import { actions } from '../../patch/store'
import type { Patch } from '../../patch/types'
import { MinePanel } from '../cloud/MinePanel'
import { HistoryList } from '../HistoryList'
import { Modal } from '../Modal'

type Tab = 'here' | 'online' | 'history'

/** Every rack of yours in one place: saved in this browser, saved online
 *  (with their short links), and this rack's earlier versions. Opening one
 *  replaces the rack on screen (Ctrl+Z brings it back). */
export function MyRacks({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('here')
  const here = useLibrary()
  const open = (p: Patch, name: string) => {
    actions.load(structuredClone(p))
    rackName.set(name)
    onClose()
  }
  return (
    <Modal title="My racks" onClose={onClose} wide>
      <div className="cloud-tabs">
        <button className={tab === 'here' ? 'on' : ''} onClick={() => setTab('here')}>
          In this browser
        </button>
        <button className={tab === 'online' ? 'on' : ''} onClick={() => setTab('online')}>
          Online
        </button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
          Earlier versions
        </button>
      </div>
      {tab === 'here' &&
        (here.length ? (
          <div className="cloud-list">
            {here.map((e) => (
              <div key={e.name} className="cloud-item">
                <button className="cloud-open" onClick={() => open(e.patch, e.name)}>
                  <b>{e.name}</b>
                  <span>
                    {e.patch.modules.length} modules · saved {new Date(e.savedAt).toLocaleString()}
                  </span>
                </button>
                <button className="preset-del" title={`Delete “${e.name}”`} onClick={() => confirm(`Delete “${e.name}”?`) && patchLibrary.remove(e.name)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="share-fine cloud-body">Nothing here yet. The rack’s menu → “Save a copy to My racks” keeps one in this browser; Share → Short link keeps one online.</p>
        ))}
      {tab === 'online' && <MinePanel />}
      {tab === 'history' && (
        <div className="cloud-list history-list">
          <HistoryList onLoad={(v) => open(v.patch, rackName.get())} />
          <p className="share-fine">Your own rack is snapshotted every couple of minutes while it changes (the last 50 are kept). A sandbox keeps none.</p>
        </div>
      )}
    </Modal>
  )
}
