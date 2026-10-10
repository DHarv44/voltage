import { useEffect, useState } from 'react'
import { cloud, shortLink, type CloudMeta } from '../../cloud/api'

/** The public gallery: racks people have shared, after review. Opening one
 *  loads it in a scratch rack (yours isn't touched). */
export function BrowsePanel() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'new' | 'top'>('new')
  const [list, setList] = useState<CloudMeta[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      cloud.gallery(q, sort).then(
        (l) => {
          setList(l)
          setErr('')
        },
        (e: Error) => setErr(e.message),
      )
    }, 250) // wait for typing to pause
    return () => clearTimeout(t)
  }, [q, sort])

  return (
    <div className="cloud-body">
      <div className="cloud-search">
        <input value={q} placeholder="Search titles and notes" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        <select value={sort} onChange={(e) => setSort(e.target.value as 'new' | 'top')}>
          <option value="new">Newest</option>
          <option value="top">Most opened</option>
        </select>
      </div>
      {err && <p className="share-warn">{err}</p>}
      {list && !list.length && <p className="share-fine">{q ? 'Nothing matches.' : 'The gallery is empty so far: save a rack as Public to be the first.'}</p>}
      <div className="cloud-list">
        {list?.map((p) => (
          <div key={p.id} className="cloud-item">
            <button className="cloud-open" onClick={() => (location.href = shortLink(p.id))}>
              <b>{p.title || 'untitled'}</b>
              <span>
                {p.note ? `${p.note} · ` : ''}
                {p.modules} modules · opened {p.opens}×
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
