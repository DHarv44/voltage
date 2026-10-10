import { useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'
import { recorder, useRecorder } from '../audio/recorder'
import { history, patchStore } from '../patch/store'
import { AppMenu } from './AppMenu'
import { ExploreMenu } from './ExploreMenu'
import { PowerButton } from './PowerButton'
import { RackTitle } from './racks/RackTitle'
import { ShareButton } from './share/ShareDialog'
import { LearnMenu } from './tutorial/LearnMenu'

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

/** The top bar: this rack (the ☰ menu, its name and where it's kept) on the
 *  left; on the right the transport (POWER, REC), undo / redo, then explore,
 *  learn and share. Everything after the status text keeps a fixed width (REC
 *  too, recording or not), so POWER never moves when it's switched. */
export function TopBar() {
  const st = useSyncExternalStore(engine.subscribe, engine.getStatus)
  useSyncExternalStore(patchStore.subscribe, patchStore.get) // undo/redo availability
  const rec = useRecorder()

  return (
    <header className="topbar">
      <div className="tb-left">
        <AppMenu />
        <div className="brand">VOLTAGE</div>
        <RackTitle />
      </div>

      <div className="tb-right">
        {(st.power || st.error) && (
          <div className="status" title="Sample rate · how long sound takes to reach your speakers">
            {st.power && `${(st.sampleRate / 1000).toFixed(1)} kHz · ${st.latencyMs.toFixed(0)} ms`}
            {st.error && <span className="err"> {st.error}</span>}
          </div>
        )}
        <PowerButton />
        <button
          className={rec.recording ? 'rec on' : 'rec'}
          disabled={!st.power}
          onClick={() => (rec.recording ? void recorder.stop() : recorder.start())}
          title="Record what you hear to a WAV file"
        >
          <span className="rec-dot" />
          {rec.recording ? `STOP ${fmtTime(rec.seconds)}` : 'REC'}
        </button>
        <span className="tb-sep" />
        <button className="history-btn" onClick={history.undo} disabled={!history.canUndo()} title={`Undo (${mod}+Z)`} aria-label="Undo">
          ↶
        </button>
        <button className="history-btn" onClick={history.redo} disabled={!history.canRedo()} title={`Redo (${mod}+Shift+Z or ${mod}+Y)`} aria-label="Redo">
          ↷
        </button>
        <span className="tb-sep" />
        <ExploreMenu />
        <LearnMenu />
        <ShareButton />
      </div>
    </header>
  )
}
