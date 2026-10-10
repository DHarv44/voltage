import { useEffect, useState, useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'
import { actions, patchStore } from '../patch/store'
import { COURSES } from '../tutorial/lessons/courses'
import { tutorial } from '../tutorial/runner'
import { useShared } from './share/sharedState'

const WELCOMED = 'voltage.welcomed.v1'
const firstVisit = () => {
  try {
    return !localStorage.getItem(WELCOMED)
  } catch {
    return false
  }
}
const remember = () => {
  try {
    localStorage.setItem(WELCOMED, '1')
  } catch {
    /* asked again next time */
  }
}

/** Worth a start screen: a first visit, or coming back to an empty rack (with
 *  nothing loaded there's nothing to switch on yet). A rack that's already
 *  there just waits for POWER. Lessons have their own start. */
const wanted = (first: boolean, sharing: boolean) =>
  !new URLSearchParams(location.search).has('learn') && (first || (!sharing && patchStore.get().modules.length === 0))

/** The start screen. Browsers won't play sound until you click, so ▶ Start
 *  is that click: it switches the sound on. A first visit gets three ways in;
 *  a shared rack shows what it is. Esc or a click beside it closes it without
 *  sound (patching silently is fine). */
export function StartScreen() {
  const st = useSyncExternalStore(engine.subscribe, engine.getStatus)
  const shared = useShared()
  const [first] = useState(firstVisit)
  const [open, setOpen] = useState(() => wanted(first, shared.kind !== 'none'))

  useEffect(() => {
    if (st.power) setOpen(false)
  }, [st.power])
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])
  if (!open || st.power) return null

  const start = () => {
    remember()
    void engine.setPower(true)
    setOpen(false)
  }
  const empty = () => {
    actions.clear()
    start()
  }
  const learn = () => {
    remember()
    tutorial.open(COURSES[0].lessons[0].id, 'guided')
  }

  const rack = shared.kind === 'open' ? shared : null
  return (
    <div className="start-screen" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="start-card" role="dialog" aria-label="Start VOLTAGE">
        <div className="start-brand">
          VOLTAGE <span>modular</span>
        </div>
        {rack ? (
          <div className="start-rack">
            <b>{rack.title || 'A shared rack'}</b>
            {rack.note && <span>{rack.note}</span>}
          </div>
        ) : (
          <p className="start-tag">A modular synthesizer you patch with cables, right here in your browser.</p>
        )}
        {shared.kind === 'loading' && <p className="start-tag">Opening the rack…</p>}

        {first && !rack ? (
          <div className="start-choices">
            <button className="start-choice main" onClick={start} autoFocus>
              <b>▶ Hear something</b>
              <span>Switch the sound on and play the rack that’s waiting for you.</span>
            </button>
            <button className="start-choice" onClick={learn}>
              <b>Learn the basics</b>
              <span>A first lesson: patch an oscillator to the speakers, step by step.</span>
            </button>
            <button className="start-choice" onClick={empty}>
              <b>Start with an empty rack</b>
              <span>For when you know your way around a modular.</span>
            </button>
          </div>
        ) : (
          <>
            <button className="start-go" onClick={start} autoFocus>
              ▶ Start
            </button>
            {!rack && (
              <div className="start-links">
                <button onClick={learn}>Learn the basics</button>
                <button onClick={empty}>Start with an empty rack</button>
              </div>
            )}
          </>
        )}
        <p className="start-fine">Browsers only allow sound after a click: this is that click. Esc to look around in silence first.</p>
      </div>
    </div>
  )
}
