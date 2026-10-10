import { useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'
import { recorder, useRecorder } from '../audio/recorder'
import { history, patchStore } from '../patch/store'
import { AppMenu } from './AppMenu'
import { ExploreMenu } from './ExploreMenu'
import { RackTitle } from './racks/RackTitle'
import { ShareButton } from './share/ShareDialog'
import { LearnMenu } from './tutorial/LearnMenu'

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** The top bar, in three parts: this rack (the ☰ menu, its name and where it's
 *  kept) on the left, the transport (POWER and REC) in the middle, and what
 *  you do with it (undo, explore, learn, share) on the right. */
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

      <div className="tb-transport">
        <button
          className={st.power ? 'power on' : 'power'}
          onClick={() => engine.setPower(!st.power)}
          disabled={st.booting}
          role="switch"
          aria-checked={st.power}
          title={st.power ? 'Switch the sound off' : 'Switch the sound on (browsers need a click before audio can start)'}
        >
          <span className="power-switch">
            <span className="power-knob" />
          </span>
          POWER
          <span className="power-state">{st.booting ? '…' : st.power ? 'ON' : 'OFF'}</span>
        </button>
        <button
          className={rec.recording ? 'rec on' : 'rec'}
          disabled={!st.power}
          onClick={() => (rec.recording ? void recorder.stop() : recorder.start())}
          title="Record what you hear to a WAV file"
        >
          <span className="rec-dot" />
          {rec.recording ? `STOP ${fmtTime(rec.seconds)}` : 'REC'}
        </button>
        {(st.power || st.error) && (
          <div className="status" title="Sample rate · how long sound takes to reach your speakers">
            {st.power && `${(st.sampleRate / 1000).toFixed(1)} kHz · ${st.latencyMs.toFixed(0)} ms`}
            {st.error && <span className="err"> {st.error}</span>}
          </div>
        )}
      </div>

      <div className="tb-right">
        <button className="history-btn" onClick={history.undo} disabled={!history.canUndo()} title="Undo (Ctrl+Z)" aria-label="Undo">
          ↶
        </button>
        <button className="history-btn" onClick={history.redo} disabled={!history.canRedo()} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
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
