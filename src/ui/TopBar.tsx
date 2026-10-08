import { useRef, useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'
import { recorder, useRecorder } from '../audio/recorder'
import { SCRATCH } from '../patch/persist'
import { RAIL_SIZES, railHp, usedHp } from '../patch/layout'
import { PresetMenu } from './PresetMenu'
import { LearnMenu } from './tutorial/LearnMenu'
import { ShareMenu } from './share/ShareMenu'
import { actions, history, patchStore } from '../patch/store'
import { settings, useSettings } from './settings'

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function TopBar() {
  const st = useSyncExternalStore(engine.subscribe, engine.getStatus)
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get) // undo/redo availability, rail width
  const s = useSettings()
  const rec = useRecorder()
  const fileRef = useRef<HTMLInputElement>(null)

  const exportPatch = () => {
    const blob = new Blob([JSON.stringify(patchStore.get(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'voltage-patch.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importPatch = async (f: File | undefined) => {
    if (!f) return
    try {
      if (!actions.load(JSON.parse(await f.text()))) alert('Not a VOLTAGE patch file.')
    } catch {
      alert('Could not read that file.')
    }
  }

  return (
    <header className="topbar">
      <div className="brand">
        VOLTAGE <span>modular</span>
      </div>
      {SCRATCH && (
        <span className="scratch-badge" title="?scratch mode: this rack is never saved">
          SCRATCH · NOT SAVED
          <button onClick={() => (location.href = location.pathname)} title="Leave this scratch rack and go back to your own saved rack">
            My rack ↩
          </button>
        </span>
      )}
      <button
        className={st.power ? 'power on' : 'power'}
        onClick={() => engine.setPower(!st.power)}
        disabled={st.booting}
        title={st.power ? 'Switch the rack off' : 'Switch the rack on (browsers need a click before audio can start)'}
      >
        <span className="power-led" />
        {st.booting ? 'BOOTING' : st.power ? 'POWER ON' : 'POWER OFF'}
      </button>
      <button
        className={rec.recording ? 'rec on' : 'rec'}
        disabled={!st.power}
        onClick={() => (rec.recording ? void recorder.stop() : recorder.start())}
        title="Record the master output to a 24-bit WAV"
      >
        <span className="rec-dot" />
        {rec.recording ? `STOP ${fmtTime(rec.seconds)}` : 'REC'}
      </button>
      <div className="status">
        {st.power ? `${(st.sampleRate / 1000).toFixed(1)} kHz · ${st.latencyMs.toFixed(1)} ms · ${st.midi}` : 'Standby'}
        {st.error && <span className="err"> · {st.error}</span>}
      </div>
      <div className="spacer" />
      <label className="ctl">
        Zoom
        <input
          type="range"
          min={0.3}
          max={1.5}
          step={0.05}
          value={s.zoom ?? 0.8}
          onChange={(e) => settings.set({ zoom: Number(e.target.value) })}
        />
        <button className={s.zoom === null ? 'mini active' : 'mini'} onClick={() => settings.set({ zoom: null })}>
          Fit
        </button>
      </label>
      <label className="ctl">
        Cables
        <input
          type="range"
          min={0.15}
          max={1}
          step={0.05}
          value={s.cableOpacity}
          onChange={(e) => settings.set({ cableOpacity: Number(e.target.value) })}
        />
      </label>
      <label className="ctl" title="While you drag a cable, ring every jack it could go to: free inputs from an output, every output from an input">
        <input type="checkbox" checked={s.jackHints} onChange={(e) => settings.set({ jackHints: e.target.checked })} />
        Jack hints
      </label>
      <label className="ctl" title="Plain-words explanations when you hover a jack or a knob: what a gate or V/OCT is, what CUTOFF or RESONANCE does. Turn off once you know your way around.">
        <input type="checkbox" checked={s.explain} onChange={(e) => settings.set({ explain: e.target.checked })} />
        Explain
      </label>
      <label className="ctl" title="Heavy load droops the ±12 V rails: outputs clip earlier, oscillators go slightly flat">
        <input type="checkbox" checked={s.psuSag} onChange={(e) => settings.set({ psuSag: e.target.checked })} />
        PSU sag
      </label>
      <label className="ctl" title="Faint (−56 dB) bleed between neighbouring jacks">
        <input type="checkbox" checked={s.crosstalk} onChange={(e) => settings.set({ crosstalk: e.target.checked })} />
        Crosstalk
      </label>
      <div className="btns">
        <button className="history-btn" onClick={history.undo} disabled={!history.canUndo()} title="Undo (Ctrl+Z)">
          ↶
        </button>
        <button className="history-btn" onClick={history.redo} disabled={!history.canRedo()} title="Redo (Ctrl+Shift+Z)">
          ↷
        </button>
        <button onClick={actions.addRow}>+ Row</button>
        <button onClick={actions.removeRow}>− Row</button>
        <select
          className="rail-select"
          value={railHp(patch)}
          title="Rail width: how many HP each row of the case holds"
          onChange={(e) => {
            if (!actions.setRail(Number(e.target.value))) alert('Modules sit beyond that width: move them in first.')
          }}
        >
          {RAIL_SIZES.map((hp) => (
            <option key={hp} value={hp} disabled={hp < usedHp(patch)}>
              {hp} HP rails
            </option>
          ))}
        </select>
        <button onClick={actions.clear} title="Clear the rack (Ctrl+Z to undo)">
          New
        </button>
        <PresetMenu />
        <LearnMenu />
        <ShareMenu />
        <button onClick={exportPatch}>Export</button>
        <button onClick={() => fileRef.current?.click()}>Import</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void importPatch(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </header>
  )
}
