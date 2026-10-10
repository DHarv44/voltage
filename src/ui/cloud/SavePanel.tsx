import { useState } from 'react'
import { cloud, shortLink, type CloudMeta, type Visibility } from '../../cloud/api'
import { cloudCurrent, useCloudCurrent } from '../../cloud/current'
import { collectRecordings } from '../../patch/bundle'
import { patchStore } from '../../patch/store'

export const VISIBILITY: { id: Visibility; name: string; what: string }[] = [
  { id: 'private', name: 'Private', what: 'Only you (this browser, or devices you give your code to).' },
  { id: 'unlisted', name: 'Link only', what: 'Anyone you send the link to.' },
  { id: 'public', name: 'Public', what: 'Listed in Browse once the admin has had a look.' },
]

/** Copy to the clipboard; if the browser won't, show it to copy by hand
 *  (`ask`) or just say it didn't work. */
export async function copy(text: string, ask = true): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    if (ask) window.prompt('Copy this:', text)
    return false
  }
}

/** Save the rack as it is now (with its recordings): as a new cloud rack, or
 *  over the one it came from if that's yours. */
export function SavePanel() {
  const current = useCloudCurrent()
  const [title, setTitle] = useState(current?.title ?? '')
  const [note, setNote] = useState(current?.note ?? '')
  const [vis, setVis] = useState<Visibility>(current?.visibility ?? 'unlisted')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<CloudMeta | null>(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const go = async (update: boolean) => {
    setBusy(true)
    setErr('')
    try {
      const patch = patchStore.get()
      const b = { patch, recordings: await collectRecordings(patch), title, note }
      const meta = update && current ? await cloud.update(current.id, b, title, note, vis) : await cloud.save(b, title, note, vis)
      cloudCurrent.set(meta)
      setDone(meta)
      setCopied(await copy(shortLink(meta.id), false))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="share-panel cloud-body">
      <label>
        Title
        <input value={title} maxLength={80} placeholder="e.g. Midnight jelly" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      </label>
      <label>
        Note
        <textarea value={note} maxLength={400} rows={2} placeholder="e.g. Turn the CUTOFF slowly" onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      </label>
      <div className="cloud-vis">
        {VISIBILITY.map((v) => (
          <label key={v.id} className={vis === v.id ? 'on' : ''}>
            <input type="radio" name="cloud-vis" checked={vis === v.id} onChange={() => setVis(v.id)} />
            <b>{v.name}</b>
            <span>{v.what}</span>
          </label>
        ))}
      </div>
      <div className="cloud-actions">
        {current && (
          <button className="primary" disabled={busy} onClick={() => void go(true)} title="Replace your saved copy with the rack as it is now (same link)">
            Update “{current.title || 'untitled'}”
          </button>
        )}
        <button className={current ? '' : 'primary'} disabled={busy} onClick={() => void go(false)}>
          {busy ? 'Saving…' : current ? 'Save as new' : 'Save to cloud'}
        </button>
      </div>
      {done && (
        <p className="share-ok">
          Saved ✓ {copied ? 'Link copied:' : 'Its link:'} <a href={shortLink(done.id)}>{shortLink(done.id)}</a>
          {done.status === 'pending' && ' (in the gallery once it’s been reviewed)'}
        </p>
      )}
      {err && <p className="share-warn">{err}</p>}
      <p className="share-fine">Recordings (LOOP, SAMPLE, tape…) go too, up to 20 MB. No account: this browser owns what it saves (see This device).</p>
    </div>
  )
}
