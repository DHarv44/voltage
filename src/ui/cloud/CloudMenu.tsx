import { useEffect, useRef, useState } from 'react'
import { adminKey } from '../../cloud/api'
import { AdminPanel } from './AdminPanel'
import { BrowsePanel } from './BrowsePanel'
import { DevicePanel } from './DevicePanel'
import { MinePanel } from './MinePanel'
import { SavePanel } from './SavePanel'

type Tab = 'save' | 'mine' | 'browse' | 'device' | 'admin'
const TABS: { id: Tab; name: string }[] = [
  { id: 'save', name: 'Save' },
  { id: 'mine', name: 'My racks' },
  { id: 'browse', name: 'Browse' },
  { id: 'device', name: 'This device' },
]

/** Top-bar "Cloud": save the rack (recordings and all) to the VOLTAGE server
 *  and get a short link, your saved racks, the public gallery, and moving
 *  your racks to another device. No sign-in: this browser's owner key owns
 *  what it saves. */
export function CloudMenu() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('save')
  const [admin, setAdmin] = useState(() => !!adminKey.get())
  const root = useRef<HTMLDivElement>(null)

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

  const tabs = admin ? [...TABS, { id: 'admin' as Tab, name: 'Admin' }] : TABS
  return (
    <div className="preset-menu" ref={root}>
      <button className={open ? 'active' : ''} onClick={() => setOpen((o) => !o)} title="Save racks online and share them with a short link">
        Cloud ▾
      </button>
      {open && (
        <div className="preset-list cloud-panel" style={{ right: 0 }}>
          <div className="cloud-tabs">
            {tabs.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
          {tab === 'save' && <SavePanel />}
          {tab === 'mine' && <MinePanel />}
          {tab === 'browse' && <BrowsePanel />}
          {tab === 'device' && <DevicePanel onAdmin={(on) => (setAdmin(on), on && setTab('admin'))} />}
          {tab === 'admin' && admin && <AdminPanel />}
        </div>
      )}
    </div>
  )
}
