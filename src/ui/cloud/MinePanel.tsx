import { useEffect, useState } from 'react'
import { cloud, shortLink, type CloudMeta, type Visibility } from '../../cloud/api'
import { cloudCurrent } from '../../cloud/current'
import { copy, VISIBILITY } from './SavePanel'

const STATUS: Record<string, string> = { pending: 'waiting for review', approved: 'in the gallery', rejected: 'not accepted for the gallery' }
export const sizeOf = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`)

/** Your cloud racks (this browser's owner key): open, copy the link, change
 *  who can see it, delete. */
export function MinePanel() {
  const [list, setList] = useState<CloudMeta[] | null>(null)
  const [err, setErr] = useState('')
  const load = () =>
    cloud.mine().then(
      (l) => setList(l),
      (e: Error) => setErr(e.message),
    )
  useEffect(() => {
    void load()
  }, [])

  const setVis = (p: CloudMeta, v: Visibility) =>
    cloud.describe(p.id, p.title, p.note, v).then(
      () => load(),
      (e: Error) => setErr(e.message),
    )
  const del = (p: CloudMeta) => {
    if (!confirm(`Delete “${p.title || 'untitled'}” from the cloud? Its link stops working.`)) return
    void cloud.remove(p.id).then(
      () => {
        if (cloudCurrent.get()?.id === p.id) cloudCurrent.set(null)
        return load()
      },
      (e: Error) => setErr(e.message),
    )
  }

  if (err) return <p className="share-warn cloud-body">{err}</p>
  if (!list) return <p className="share-fine cloud-body">Loading…</p>
  if (!list.length) return <p className="share-fine cloud-body">Nothing saved from this browser yet. Save one from the Save tab (or bring your racks from another device under This device).</p>
  return (
    <div className="cloud-list">
      {list.map((p) => (
        <div key={p.id} className="cloud-item">
          <button className="cloud-open" onClick={() => (location.href = shortLink(p.id))} title="Open it (in a scratch rack: your own rack isn’t touched)">
            <b>{p.title || 'untitled'}</b>
            <span>
              {p.modules} modules · {sizeOf(p.size)} · opened {p.opens}× · {new Date(p.updated).toLocaleDateString()}
              {p.visibility === 'public' && STATUS[p.status] ? ` · ${STATUS[p.status]}` : ''}
            </span>
          </button>
          <select value={p.visibility} onChange={(e) => void setVis(p, e.target.value as Visibility)} title="Who can open it">
            {VISIBILITY.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button className="mini" onClick={() => void copy(shortLink(p.id))} title="Copy its link">
            Link
          </button>
          <button className="preset-del" onClick={() => del(p)} title="Delete it">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
