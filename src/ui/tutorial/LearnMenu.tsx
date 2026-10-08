import { useEffect, useRef, useState } from 'react'
import { COURSES } from '../../tutorial/lessons/courses'
import { tutorial } from '../../tutorial/runner'

/** Top-bar "Learn" dropdown: every course and its lessons, in either mode.
 *  Lessons open in a scratch rack, so your own patch is left exactly as it is. */
export function LearnMenu() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="preset-menu" ref={root}>
      <button className={open ? 'active learn-btn' : 'learn-btn'} onClick={() => setOpen((o) => !o)}>
        Learn ▾
      </button>
      {open && (
        <div className="preset-list learn-list" style={{ right: 0 }}>
          <div className="learn-note">
            <b>Walkthrough</b>: read along and press Next; it does each step for you and you hear the change.
            <br />
            <b>Guided</b>: you do each step yourself; it notices and moves on. Your own rack isn’t touched.
          </div>
          {COURSES.map((c) => (
            <div key={c.title}>
              <div className="preset-group">{c.title}</div>
              <div className="learn-note">{c.note}</div>
              {c.lessons.map((l) => (
                <div key={l.id} className="learn-row">
                  <div className="learn-info">
                    <span className="preset-name">{l.title}</span>
                    <span className="preset-desc">{l.summary}</span>
                  </div>
                  <button onClick={() => tutorial.open(l.id, 'walkthrough')}>Walkthrough</button>
                  <button onClick={() => tutorial.open(l.id, 'guided')}>Guided</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
