import { perform, usePerform } from './perform'
import { PowerButton } from './PowerButton'

/** In performance mode, the one strip left: POWER and the way back. It fades
 *  until the pointer comes near (CSS). */
export function PerformStrip() {
  const on = usePerform()
  if (!on) return null
  return (
    <div className="perform-strip">
      <PowerButton />
      <button className="perform-leave" onClick={() => perform.set(false)} title="Leave performance mode (Esc or `)">
        Leave · Esc
      </button>
    </div>
  )
}
