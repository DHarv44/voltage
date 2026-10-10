import { useEffect, useState } from 'react'
import { cloud, shortLink, type CloudMeta } from '../../cloud/api'
import { sizeOf } from './MinePanel'

type Item = CloudMeta & { why: { reason: string; at: number }[] }

/** The admin's queue: public racks waiting for a look, and anything people
 *  reported. Open one to check it (in a new tab), then approve it for the
 *  gallery, turn it down, or delete it. */
export function AdminPanel() {
  const [data, setData] = useState<{ stats: { patches: number; bytes: number }; queue: Item[] } | null>(null)
  const [err, setErr] = useState('')
  const load = () =>
    cloud.admin.queue().then(
      (d) => setData(d),
      (e: Error) => setErr(e.message),
    )
  useEffect(() => {
    void load()
  }, [])
  const act = (p: Promise<unknown>) =>
    p.then(
      () => load(),
      (e: Error) => setErr(e.message),
    )

  if (err) return <p className="share-warn cloud-body">{err}</p>
  if (!data) return <p className="share-fine cloud-body">Loading…</p>
  return (
    <div className="cloud-body">
      <p className="share-fine">
        {data.stats.patches} racks stored · {sizeOf(data.stats.bytes)} · {data.queue.length ? `${data.queue.length} to look at` : 'nothing waiting'}
      </p>
      <div className="cloud-list">
        {data.queue.map((p) => (
          <div key={p.id} className="cloud-item admin">
            <a className="cloud-open" href={shortLink(p.id)} target="_blank" rel="noreferrer">
              <b>{p.title || 'untitled'}</b>
              <span>
                {p.visibility === 'public' && p.status === 'pending' ? 'wants the gallery · ' : ''}
                {p.reports ? `${p.reports} report${p.reports > 1 ? 's' : ''} · ` : ''}
                {p.modules} modules · {sizeOf(p.size)}
              </span>
              {p.note && <span>“{p.note}”</span>}
              {p.why.map((w) => (
                <span key={w.at} className="share-warn">
                  Reported: {w.reason}
                </span>
              ))}
            </a>
            {p.visibility === 'public' && p.status !== 'approved' && (
              <button className="mini" onClick={() => void act(cloud.admin.approve(p.id))}>
                Approve
              </button>
            )}
            {p.visibility === 'public' && p.status !== 'rejected' && (
              <button className="mini" onClick={() => void act(cloud.admin.reject(p.id))}>
                Turn down
              </button>
            )}
            <button className="preset-del" title="Delete it for good" onClick={() => confirm(`Delete “${p.title || 'untitled'}” for good?`) && void act(cloud.remove(p.id, true))}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
