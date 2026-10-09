import { useEffect, useState } from 'react'
import { versions, type Version } from '../patch/versions'

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 90) return 'just now'
  const m = Math.round(s / 60)
  if (m < 90) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 36) return `${h} h ago`
  return new Date(t).toLocaleDateString()
}

/** The Patches menu's "Earlier versions": your rack as it was over the last
 *  hours and days (newest first). Loading one replaces the rack; Ctrl+Z
 *  brings today's back. Shows the latest few, the rest behind "More". */
export function HistoryList({ onLoad }: { onLoad: (v: Version) => void }) {
  const [list, setList] = useState<Version[] | null>(null)
  const [all, setAll] = useState(false)
  useEffect(() => {
    void versions.list().then(setList)
  }, [])
  if (!list?.length) return null
  // the newest is the rack as it is now
  const earlier = list.slice(1)
  if (!earlier.length) return null
  const shown = all ? earlier : earlier.slice(0, 6)
  return (
    <>
      <div className="preset-group">Earlier versions of this rack</div>
      {shown.map((v) => (
        <button key={v.id} className="preset-item" onClick={() => onLoad(v)}>
          <span className="preset-name">{ago(v.t)}</span>
          <span className="preset-desc">
            {v.patch.modules.length} modules · {v.patch.cables.length} cables · {new Date(v.t).toLocaleString()}
          </span>
        </button>
      ))}
      {!all && earlier.length > shown.length && (
        <button className="preset-item" onClick={() => setAll(true)}>
          <span className="preset-desc">More ({earlier.length - shown.length})…</span>
        </button>
      )}
    </>
  )
}
