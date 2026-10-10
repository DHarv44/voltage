import { useSyncExternalStore } from 'react'
import { engine } from '../audio/engine'

/** POWER, built like REC: a square button with a lamp that lights when the
 *  sound is on. Its width never changes, so nothing around it shifts. Lessons
 *  find it by the `power` class. */
export function PowerButton() {
  const st = useSyncExternalStore(engine.subscribe, engine.getStatus)
  return (
    <button
      className={st.power ? 'power on' : 'power'}
      onClick={() => engine.setPower(!st.power)}
      disabled={st.booting}
      role="switch"
      aria-checked={st.power}
      title={st.power ? 'Switch the sound off' : 'Switch the sound on (browsers need a click before audio can start)'}
    >
      <span className="power-lamp" />
      POWER
    </button>
  )
}
