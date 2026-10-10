import { useState } from 'react'
import { adminKey, cloud, ownerKey, validKey } from '../../cloud/api'
import { copy } from './shared'

/** This browser's owner key: copy it to another device to see and edit your
 *  racks there, or bring a key here from another device. Also where the admin
 *  key is entered. */
export function DevicePanel({ onAdmin }: { onAdmin: (on: boolean) => void }) {
  const [show, setShow] = useState(false)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [adm, setAdm] = useState('')
  const key = ownerKey()

  const bring = async () => {
    if (!validKey(code)) return setMsg('That code doesn’t look right: copy the whole thing.')
    if (code.trim() === key) return setMsg('That’s this browser’s own code.')
    try {
      const moved = await cloud.adopt(code)
      setMsg(`Done ✓ This browser now uses that code${moved ? ` (and the ${moved} rack${moved > 1 ? 's' : ''} saved here moved over to it)` : ''}.`)
      setCode('')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    }
  }
  const tryAdmin = async () => {
    adminKey.set(adm.trim())
    const ok = await cloud.admin.check().then(
      (r) => r.admin,
      () => false,
    )
    if (!ok) adminKey.set('')
    setMsg(ok ? 'Admin key accepted ✓' : 'That isn’t the admin key.')
    setAdm('')
    onAdmin(ok)
  }

  return (
    <div className="share-panel cloud-body">
      <p className="share-fine">
        Your racks belong to this browser’s code. Copy it to another computer or phone (This device → Use a code) to see and edit them there too. Keep it private: whoever has it can change your racks.
      </p>
      <div className="cloud-key">
        <code>{show ? key : '•'.repeat(24)}</code>
        <button className="mini" onClick={() => setShow((s) => !s)}>
          {show ? 'Hide' : 'Show'}
        </button>
        <button className="mini" onClick={() => void copy(key).then((ok) => ok && setMsg('Code copied ✓'))}>
          Copy
        </button>
      </div>
      <label>
        Use a code from another device
        <div className="cloud-search">
          <input value={code} placeholder="Paste the code" onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          <button onClick={() => void bring()}>Use it</button>
        </div>
      </label>
      {msg && <p className="share-ok">{msg}</p>}
      <details className="cloud-admin">
        <summary>Admin</summary>
        {adminKey.get() ? (
          <button className="mini" onClick={() => (adminKey.set(''), onAdmin(false), setMsg('Admin key forgotten on this browser.'))}>
            Forget the admin key
          </button>
        ) : (
          <div className="cloud-search">
            <input type="password" value={adm} placeholder="Admin key" onChange={(e) => setAdm(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            <button onClick={() => void tryAdmin()}>Enter</button>
          </div>
        )}
      </details>
    </div>
  )
}
