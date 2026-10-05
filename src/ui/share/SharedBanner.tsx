import { useState } from 'react'
import { patchLibrary } from '../../patch/library'
import { patchStore } from '../../patch/store'
import { sharedPatch, useShared } from './sharedState'

/** Strip under the top bar when the page was opened from a shared link: who
 *  sent what (title, note), and what to do with it. */
export function SharedBanner() {
  const s = useShared()
  const [saved, setSaved] = useState('')
  if (s.kind === 'none' || s.kind === 'loading') return null
  if (s.kind === 'bad')
    return (
      <div className="share-banner bad">
        <span>Couldn’t open this shared patch: the link looks incomplete or damaged.</span>
        <button onClick={() => (location.href = location.pathname)}>Back to my rack</button>
        <button className="x" onClick={sharedPatch.dismiss} title="Dismiss">
          ✕
        </button>
      </div>
    )
  const name = s.title || 'Shared patch'
  const keep = () => {
    // into "my patches", next to (not over) the friend's own rack
    let n = name
    for (let k = 2; patchLibrary.has(n); k++) n = `${name} (${k})`
    setSaved(patchLibrary.save(n, patchStore.get()) ? n : '')
  }
  return (
    <div className="share-banner">
      <span className="share-tag">SHARED</span>
      <b>{name}</b>
      {s.note && <span className="share-note">{s.note}</span>}
      {s.hadAudio && <span className="share-warn">Recordings (LOOP, SAMPLE…) don’t travel in links: those modules arrive empty.</span>}
      <span className="share-hint">Press POWER ON to hear it.</span>
      <div className="spacer" />
      {saved ? (
        <span className="share-saved">Saved as “{saved}” in Patches ✓</span>
      ) : (
        <button onClick={keep} title="Save it to your own Patches list (your current rack isn’t touched)">
          Keep this rack
        </button>
      )}
      <button onClick={() => (location.href = location.pathname)} title="Leave the shared patch and go back to your own rack">
        Back to my rack
      </button>
    </div>
  )
}
