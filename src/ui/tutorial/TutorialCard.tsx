import { useEffect, useState, useSyncExternalStore } from 'react'
import { tutorial } from '../../tutorial/runner'

/** The lesson card: what's going on, what to do, what to listen for. */
export function TutorialCard() {
  const st = useSyncExternalStore(
    (f) => tutorial.subscribe(f),
    () => tutorial.state,
  )
  const [busy, setBusy] = useState(false)
  useEffect(() => setBusy(false), [st.index])
  const lesson = st.lesson
  if (!lesson) return null
  const step = lesson.steps[st.index]
  const last = st.index === lesson.steps.length - 1
  const guided = st.mode === 'guided'
  const waiting = guided && !!step.action && !st.done

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    await fn()
    setBusy(false)
  }

  return (
    <div className="tutorial-card" role="dialog" aria-label={lesson.title}>
      <div className="tut-head">
        <span className="tut-title">{lesson.title}</span>
        <span className="tut-mode">{guided ? 'GUIDED' : 'WALKTHROUGH'}</span>
        <button className="tut-x" onClick={() => tutorial.exit()} title="Leave the lesson and go back to your rack">
          ✕
        </button>
      </div>
      <div className="tut-progress">
        {lesson.steps.map((_, i) => (
          <span key={i} className={i < st.index ? 'past' : i === st.index ? 'now' : ''} />
        ))}
      </div>
      <p className="tut-text">{step.text}</p>
      {step.task && (
        <p className={st.done ? 'tut-task done' : 'tut-task'}>
          {st.done ? '✓ ' : guided ? '→ ' : '▶ '}
          {step.task}
        </p>
      )}
      {step.listen && st.done && <p className="tut-listen">🎧 {step.listen}</p>}
      <div className="tut-buttons">
        <button onClick={() => tutorial.back()} disabled={st.index === 0 || busy}>
          Back
        </button>
        {waiting && (
          <button onClick={() => void run(() => tutorial.showMe())} disabled={busy} title="Do this step for me">
            Show me
          </button>
        )}
        {last ? (
          <button className="primary" onClick={() => tutorial.exit()}>
            Finish
          </button>
        ) : (
          <button className="primary" onClick={() => void run(() => tutorial.next())} disabled={busy || waiting}>
            {waiting ? 'Your turn…' : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}
