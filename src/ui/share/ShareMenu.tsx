import { useEffect, useRef, useState } from 'react'
import { holdsAudio } from '../../audio/buffers'
import { shareLink } from '../../patch/share'
import { patchStore } from '../../patch/store'

/** Top-bar "Share": an optional title and note, then a link to this rack that
 *  anyone can open (it carries the whole patch; no account, no upload). */
export function ShareMenu() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const hasAudio = patchStore.get().modules.some((m) => holdsAudio(m.type))
  const copy = async () => {
    const link = await shareLink(patchStore.get(), title, note)
    try {
      await navigator.clipboard.writeText(link)
      setStatus(`Link copied (${link.length.toLocaleString()} characters)`)
    } catch {
      // clipboard blocked: show it to copy by hand
      window.prompt('Copy this link:', link)
      setStatus('')
    }
  }

  return (
    <div className="preset-menu" ref={root}>
      <button className={open ? 'active' : ''} onClick={() => setOpen((o) => !o)} title="Share this rack as a link">
        Share
      </button>
      {open && (
        <div className="preset-list share-panel" style={{ right: 0 }}>
          <div className="preset-group">Share this rack</div>
          <label>
            Title
            <input value={title} maxLength={80} placeholder="e.g. Midnight jelly" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Note for your friend
            <textarea value={note} maxLength={400} rows={3} placeholder="e.g. Turn the CUTOFF slowly" onChange={(e) => setNote(e.target.value)} />
          </label>
          {hasAudio && <p className="share-warn">Recordings (LOOP, SAMPLE…) are too big for a link; those modules arrive empty. Use Export for a .voltage file that carries them.</p>}
          <button className="primary" onClick={() => void copy()}>
            Copy link
          </button>
          {status && <p className="share-ok">{status}</p>}
          <p className="share-fine">The whole patch is inside the link itself: nothing is uploaded, and it opens in a scratch rack for whoever you send it to.</p>
        </div>
      )}
    </div>
  )
}
