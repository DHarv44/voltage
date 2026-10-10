import { useState } from 'react'
import { bufferStore } from '../../audio/bufferStore'
import { cloud } from '../../cloud/api'
import { patchLibrary } from '../../patch/library'
import { patchStore } from '../../patch/store'
import { sharedPatch, useShared } from './sharedState'

/** Your own rack, whatever link this page was opened from. */
const home = () => (location.href = `${location.origin}/`)

/** Strip under the top bar when the page was opened from a shared link or a
 *  cloud short link: who sent what (title, note), and what to do with it. */
export function SharedBanner() {
  const s = useShared()
  const [saved, setSaved] = useState('')
  const [reported, setReported] = useState(false)
  if (s.kind === 'none' || s.kind === 'loading') return null
  if (s.kind === 'bad')
    return (
      <div className="share-banner bad">
        <span>Couldn’t open this rack: {s.why ?? 'the link looks incomplete or damaged.'}</span>
        <button onClick={home}>Back to my rack</button>
        <button className="x" onClick={sharedPatch.dismiss} title="Dismiss">
          ✕
        </button>
      </div>
    )
  const name = s.title || 'Shared patch'
  const keep = () => {
    // into "my patches", next to (not over) your own rack; its recordings come along
    let n = name
    for (let k = 2; patchLibrary.has(n); k++) n = `${name} (${k})`
    for (const r of s.recordings ?? []) void bufferStore.put(r.id, r.slot, { rate: r.rate, data: r.data })
    setSaved(patchLibrary.save(n, patchStore.get()) ? n : '')
  }
  const report = () => {
    const why = prompt('What’s wrong with this rack? (The admin will see this.)')?.trim()
    if (!why || !s.cloudId) return
    void cloud.report(s.cloudId, why).then(
      () => setReported(true),
      (e: Error) => alert(e.message),
    )
  }
  return (
    <div className="share-banner">
      <span className="share-tag">{s.cloudId ? (s.mine ? 'YOURS' : 'CLOUD') : 'SHARED'}</span>
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
      {s.cloudId && !s.mine && (reported ? <span className="share-saved">Reported ✓</span> : <button onClick={report}>Report</button>)}
      <button onClick={home} title="Leave this rack and go back to your own">
        Back to my rack
      </button>
    </div>
  )
}
