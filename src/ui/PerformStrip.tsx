import { useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'
import { perform, usePerform } from './perform'

/** In performance mode, the one strip left: POWER and the way back. It fades
 *  until the pointer comes near (CSS). */
export function PerformStrip() {
  const on = usePerform()
  const st = useSyncExternalStore(engine.subscribe, engine.getStatus)
  if (!on) return null
  return (
    <div className="perform-strip">
      <button className={st.power ? 'power on' : 'power'} onClick={() => engine.setPower(!st.power)} role="switch" aria-checked={st.power}>
        <span className="power-switch">
          <span className="power-knob" />
        </span>
        POWER
      </button>
      <button className="perform-leave" onClick={() => perform.set(false)} title="Leave performance mode (Esc or `)">
        Leave · Esc
      </button>
    </div>
  )
}
