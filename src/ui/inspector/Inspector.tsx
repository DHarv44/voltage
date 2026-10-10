import { useSyncExternalStore } from 'react'
import { BUFFER_SLOTS, buffers, holdsAudio } from '../../audio/buffers'
import { SPECS } from '../../modules'
import { hpOf } from '../../modules/size'
import { STARTERS } from '../../patch/starters'
import { actions, patchStore } from '../../patch/store'
import { loadStarter } from '../library/loadStarter'
import { MenuPresets } from '../rack/MenuPresets'
import { MenuSettings, settingsHost } from '../rack/MenuSettings'
import { InspectorDetails } from './InspectorDetails'
import { selection, useSelection } from './selection'

/** The Inspector: the module you clicked, explained. What it's for, its ready
 *  -to-play rig, its size, settings and presets, and every knob and jack in
 *  plain words. Everything the right-click menu and the tooltips hold, where
 *  you can read it at leisure. ✕ puts it away. */
export function Inspector() {
  const id = useSelection()
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get)
  const m = id ? patch.modules.find((x) => x.id === id) : undefined
  if (!m) return null
  const spec = SPECS[m.type]
  const host = settingsHost(m)

  const exportAudio = async () => {
    let saved = 0
    for (let s = 0; s < BUFFER_SLOTS[m.type]; s++) {
      const name = BUFFER_SLOTS[m.type] > 1 ? `${spec.title}-slot${s + 1}` : spec.title
      if (await buffers.exportWav(m.id, s, name.toLowerCase())) saved++
    }
    if (!saved) alert('Nothing to export: record something first (with the sound on).')
  }

  return (
    <aside className="inspector" aria-label={`${spec.name}: details`}>
      <header className="insp-head">
        <div>
          <span className="insp-kind">
            {spec.category} · {hpOf(m)} HP
          </span>
          <h3>{spec.name}</h3>
        </div>
        <button className="modal-x" onClick={() => selection.set(null)} aria-label="Close the Inspector" title="Close">
          ✕
        </button>
      </header>
      <p className="insp-tagline">{spec.tagline}</p>
      <div className="insp-actions">
        {STARTERS[m.type] && (
          <button className="primary" onClick={() => loadStarter(m.type)} title="Add a rig that shows what it’s for, below your rack (Ctrl+Z takes it away)">
            ▶ Add its ready-to-play rig
          </button>
        )}
        <button onClick={() => actions.addModule(m.type, { ...m.params })}>Duplicate</button>
        <button onClick={() => actions.resetParams(m.id)}>Reset knobs</button>
        {holdsAudio(m.type) && <button onClick={() => void exportAudio()}>Export audio (WAV)</button>}
        <button
          className="danger"
          onClick={() => {
            actions.removeModule(m.id)
            selection.set(null)
          }}
        >
          Remove
        </button>
      </div>
      {spec.sizes && (
        <div className="ctx-sizes insp-sizes">
          <span>Size</span>
          {spec.sizes.map((hp) => (
            <button key={hp} className={hpOf(m) === hp ? 'on' : ''} onClick={() => !actions.setWidth(m.id, hp) && alert(`No room for ${hp} HP in this row: make space first.`)}>
              {hp} HP
            </button>
          ))}
        </div>
      )}
      {host && <MenuSettings host={host} own={host.id === m.id} />}
      <MenuPresets m={m} onDone={() => {}} />
      <InspectorDetails spec={spec} params={m.params} id={m.id} patch={patch} />
    </aside>
  )
}
