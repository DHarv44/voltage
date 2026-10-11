import { useSyncExternalStore } from 'react'
import { MAX_TEXT } from '../../patch/persist'
import { actions, patchStore } from '../../patch/store'
import { PX } from '../geometry'
import type { SurfaceProps } from './common'

const PLACEHOLDER = 'Write here: how this patch works, what to turn, where it came from…'

/** NOTES: a textarea on the panel; what's typed is kept with the module. */
export function Notes({ inst, x, y, w, h }: SurfaceProps) {
  const text = useSyncExternalStore(patchStore.subscribe, () => patchStore.get().modules.find((m) => m.id === inst.id)?.text ?? '')
  return (
    <textarea
      className="notes-surface"
      value={text}
      maxLength={MAX_TEXT}
      placeholder={PLACEHOLDER}
      spellCheck={false}
      onChange={(e) => actions.setText(inst.id, e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: x * PX,
        top: y * PX,
        width: w * PX,
        height: h * PX,
        boxSizing: 'border-box',
        resize: 'none',
        border: 'none',
        borderRadius: 3,
        padding: '0.5em 0.6em',
        background: 'rgba(255, 252, 240, 0.9)',
        color: '#2b2a26',
        font: `${Math.max(9, 2.6 * PX)}px/1.35 Bahnschrift, 'Arial Narrow', sans-serif`,
        outline: 'none',
      }}
    />
  )
}
