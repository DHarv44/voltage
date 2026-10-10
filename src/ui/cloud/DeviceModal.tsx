import { useState } from 'react'
import { adminKey } from '../../cloud/api'
import { Modal } from '../Modal'
import { AdminPanel } from './AdminPanel'
import { DevicePanel } from './DevicePanel'

/** ☰ → Your racks on other devices: this browser's code (copy it, or bring
 *  one here), and, once the admin key is in, the admin queue. */
export function DeviceModal({ onClose }: { onClose: () => void }) {
  const [admin, setAdmin] = useState(() => !!adminKey.get())
  const [tab, setTab] = useState<'device' | 'admin'>('device')
  return (
    <Modal title="Your racks on other devices" onClose={onClose}>
      {admin && (
        <div className="cloud-tabs">
          <button className={tab === 'device' ? 'on' : ''} onClick={() => setTab('device')}>
            This device
          </button>
          <button className={tab === 'admin' ? 'on' : ''} onClick={() => setTab('admin')}>
            Admin
          </button>
        </div>
      )}
      {tab === 'device' || !admin ? (
        <DevicePanel
          onAdmin={(on) => {
            setAdmin(on)
            if (on) setTab('admin')
          }}
        />
      ) : (
        <AdminPanel />
      )}
    </Modal>
  )
}
