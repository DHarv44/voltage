import { useRef, useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'
import { recorder, useRecorder } from '../audio/recorder'
import { SCRATCH } from '../patch/persist'
import { PresetMenu } from './PresetMenu'
import { actions, history, patchStore } from '../patch/store'
import { settings, useSettings } from './settings'

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function TopBar() {
  const st = useSyncExternalStore(engine.subscribe, engine.getStatus)
  useSyncExternalStore(patchStore.subscribe, patchStore.get) // refresh undo/redo availability
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
        </span>
      )}
      <button
        className={st.power ? 'power on' : 'power'}
        onClick={() => engine.setPower(!st.power)}
        disabled={st.booting}
        title="Rack power"
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
      <div className="btns">
        <button className="history-btn" onClick={history.undo} disabled={!history.canUndo()} title="Undo (Ctrl+Z)">
          ↶
        </button>
        <button className="history-btn" onClick={history.redo} disabled={!history.canRedo()} title="Redo (Ctrl+Shift+Z)">
          ↷
        </button>
        <button onClick={actions.addRow}>+ Row</button>
        <button onClick={actions.removeRow}>− Row</button>
        <button onClick={actions.clear} title="Clear the rack (Ctrl+Z to undo)">
          New
        </button>
        <PresetMenu />
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
