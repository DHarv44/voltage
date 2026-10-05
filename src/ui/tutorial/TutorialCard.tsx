import { useSyncExternalStore } from 'react'
import { tutorial } from '../../tutorial/runner'

/** Slim lesson strip under the top bar: which lesson, how far along, and the
 *  lesson-level controls. The step itself lives in the bubble at the control. */
export function TutorialCard() {
  const st = useSyncExternalStore(
    (f) => tutorial.subscribe(f),
    () => tutorial.state,
  )
  const lesson = st.lesson
  if (!lesson) return null
  const step = lesson.steps[st.index]
  return (
    <div className="tut-strip" role="navigation" aria-label="Lesson">
      <span className="tut-title">{lesson.title}</span>
      <span className="tut-mode">{st.mode === 'guided' ? 'GUIDED' : 'WALKTHROUGH'}</span>
      <div className="tut-progress">
        {lesson.steps.map((_, i) => (
          <span key={i} className={i < st.index ? 'past' : i === st.index ? 'now' : ''} />
        ))}
      </div>
      <span className="tut-count">
        {st.index + 1} / {lesson.steps.length}
      </span>
      {step.action && (
        <button onClick={() => tutorial.redoStep()} title="Put the rack back to how it was at the start of this step">
          Redo step
        </button>
      )}
      <button onClick={() => tutorial.restart()} title="Start this lesson again from the beginning">
        ↺ Start over
      </button>
      <button onClick={() => tutorial.exit()} title="Leave the lesson and go back to your rack">
        Exit ✕
      </button>
    </div>
  )
}
