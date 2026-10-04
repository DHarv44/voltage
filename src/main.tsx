import { createRoot } from 'react-dom/client'
import { App } from './App'
import { engine } from './audio/engine'
import './audio/buffers' // persists and restores LOOP/SAMPLE audio
import { initQwerty } from './audio/midi'
import { telemetry } from './audio/telemetry'
import { validateSpecs } from './modules'
import { actions, history, patchStore } from './patch/store'
import { disableRackAutoscroll } from './ui/pointer'
import { initShortcuts } from './ui/shortcuts'
import { validatePresets } from './patch/presets'
import './styles.css'

if (import.meta.env.DEV) {
  const errors = [...validateSpecs(), ...validatePresets()]
  if (errors.length) console.error('Module spec / preset errors:\n' + errors.join('\n'))
  Object.assign(window, { __voltage: { patchStore, actions, history, engine, telemetry } })
}

initQwerty((ev) => engine.midi(ev))
disableRackAutoscroll()
initShortcuts()

// No StrictMode: the audio engine is a singleton and must not double-boot.
createRoot(document.getElementById('root')!).render(<App />)
