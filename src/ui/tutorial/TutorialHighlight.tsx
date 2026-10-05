import { useEffect, useSyncExternalStore } from 'react'
import { SPECS } from '../../modules'
import { patchStore } from '../../patch/store'
import { tutorial } from '../../tutorial/runner'
import { moduleLeft, PX, rowTop } from '../geometry'

/** A pulsing ring on the knob or jack the current step is about (drawn in rack
 *  space, so it scales and scrolls with the rack). The power button gets a
 *  glow instead. */
export function TutorialHighlight() {
  const st = useSyncExternalStore(
    (f) => tutorial.subscribe(f),
    () => tutorial.state,
  )
  const patch = useSyncExternalStore(patchStore.subscribe, patchStore.get)
  const step = st.lesson?.steps[st.index]
  const target = step?.target
  const power = !!target && 'ui' in target && !st.done

  useEffect(() => {
    const btn = document.querySelector('.topbar .power')
    btn?.classList.toggle('tut-glow', power)
    return () => btn?.classList.remove('tut-glow')
  }, [power])

  if (!target || 'ui' in target || st.done) return null
  const m = patch.modules.find((x) => x.id === st.mods[target.mod])
  if (!m) return null
  const c = SPECS[m.type].controls.find((k) =>
    'param' in target ? (k.kind === 'knob' || k.kind === 'switch') && k.param === target.param : k.kind === target.dir && k.jack === target.jack,
  )
  if (!c || !('x' in c)) return null
  const r = ('param' in target ? 9 : 7) * PX
  return (
    <div
      className="tut-ring"
      style={{ left: moduleLeft(m.hp) + c.x * PX - r, top: rowTop(m.row) + c.y * PX - r, width: r * 2, height: r * 2 }}
    />
  )
}
