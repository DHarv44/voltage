import { useState } from 'react'
import { holdsAudio } from '../../audio/buffers'
import { cloud, shortLink, type CloudMeta, type Visibility } from '../../cloud/api'
import { cloudCurrent, useCloudCurrent } from '../../cloud/current'
import { collectRecordings, exportRack } from '../../patch/bundle'
import { rackName, useRackName } from '../../patch/rackName'
import { shareLink } from '../../patch/share'
import { patchStore } from '../../patch/store'
import { copy, VISIBILITY } from '../cloud/shared'
import { Modal } from '../Modal'

/** The top bar's Share: one button, three ways to hand the rack on, each with
 *  a line on when to use it. */
export function ShareButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="share-btn" onClick={() => setOpen(true)} title="Share this rack: a short link, a quick link or a file">
        Share
      </button>
      {open && <ShareDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function ShareDialog({ onClose }: { onClose: () => void }) {
  const name = useRackName()
  const current = useCloudCurrent()
  // a real name carries over; the placeholder ones ("Sandbox", "My rack") don't
  const [title, setTitle] = useState(current?.title || (name === 'Sandbox' || name === 'My rack' ? '' : name))
  const [note, setNote] = useState(current?.note ?? '')
  const [vis, setVis] = useState<Visibility>(current?.visibility ?? 'unlisted')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ link: string; copied: boolean; pending?: boolean } | null>(null)
  const [err, setErr] = useState('')
  const audio = patchStore.get().modules.some((m) => holdsAudio(m.type))

  const online = async (update: boolean) => {
    setBusy(true)
    setErr('')
    try {
      const patch = patchStore.get()
      const b = { patch, recordings: await collectRecordings(patch), title, note }
      const meta: CloudMeta = update && current ? await cloud.update(current.id, b, title, note, vis) : await cloud.save(b, title, note, vis)
      cloudCurrent.set(meta)
      if (title.trim()) rackName.set(title)
      const link = shortLink(meta.id)
      setDone({ link, copied: await copy(link, false), pending: meta.status === 'pending' })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const quick = async () => {
    const link = await shareLink(patchStore.get(), title, note)
    setDone({ link, copied: await copy(link, false) })
  }

  return (
    <Modal title="Share this rack" onClose={onClose}>
      <div className="share-panel share-dialog">
        <label>
          Title
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        </label>
        <label>
          Note for whoever opens it
          <textarea value={note} maxLength={400} rows={2} placeholder="e.g. Turn the CUTOFF slowly" onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        </label>

        <div className="share-way">
          <div>
            <b>Short link</b>
            <span>Saved online, recordings included (up to 20 MB). You can update it later and keep the same link.</span>
          </div>
          <div className="cloud-vis">
            {VISIBILITY.map((v) => (
              <label key={v.id} className={vis === v.id ? 'on' : ''}>
                <input type="radio" name="share-vis" checked={vis === v.id} onChange={() => setVis(v.id)} />
                <b>{v.name}</b>
                <span>{v.what}</span>
              </label>
            ))}
          </div>
          <div className="cloud-actions">
            {current && (
              <button className="primary" disabled={busy} onClick={() => void online(true)}>
                Update “{current.title || 'untitled'}”
              </button>
            )}
            <button className={current ? '' : 'primary'} disabled={busy} onClick={() => void online(false)}>
              {busy ? 'Saving…' : current ? 'New link' : 'Make a short link'}
            </button>
          </div>
        </div>

        <div className="share-way">
          <div>
            <b>Quick link</b>
            <span>The whole patch packed into a long link: nothing is uploaded anywhere.{audio && ' Recordings (LOOP, SAMPLE…) don’t fit, so they arrive empty.'}</span>
          </div>
          <div className="cloud-actions">
            <button onClick={() => void quick()}>Copy a quick link</button>
          </div>
        </div>

        <div className="share-way">
          <div>
            <b>File</b>
            <span>A .voltage file with everything in it, to keep or send. Open it from the rack’s menu.</span>
          </div>
          <div className="cloud-actions">
            <button onClick={() => void exportRack(patchStore.get(), title.replace(/[^\w -]+/g, '').trim() || 'voltage-rack')}>Download the file</button>
          </div>
        </div>

        {done && (
          <p className="share-ok">
            {done.copied ? 'Link copied ✓ ' : 'Your link: '}
            <a href={done.link} className="share-link">
              {done.link.length > 70 ? `${done.link.slice(0, 70)}…` : done.link}
            </a>
            {done.pending && ' (in the gallery once it’s been reviewed)'}
          </p>
        )}
        {err && <p className="share-warn">{err}</p>}
      </div>
    </Modal>
  )
}
