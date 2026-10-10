import { createRoot } from 'react-dom/client'
import { App } from './App'
import { engine } from './audio/engine'
import './audio/buffers' // persists and restores LOOP/SAMPLE audio
import { initQwerty } from './audio/midi'
import { telemetry } from './audio/telemetry'
import { SPEC_LIST, validateSpecs } from './modules'
import { validateCatalog } from './modules/catalog'
import { paramGaps } from './modules/paramInfo'
import { actions, history, patchStore } from './patch/store'
import { disableRackAutoscroll } from './ui/pointer'
import { initShortcuts } from './ui/shortcuts'
import { validatePresets } from './patch/presets'
import { validateStarters } from './patch/starters'
import { validateSongs } from './patch/songs'
import { lintPanels } from './ui/panel/lint'
import { tutorial } from './tutorial/runner'
import { validateCourses } from './tutorial/validate'
import { bootShared } from './ui/share/sharedState'
import { bootCloud } from './cloud/open'
import './styles.css'

if (import.meta.env.DEV) {
  const errors = [...validateSpecs(), ...validatePresets(), ...validateStarters(), ...validateCatalog(SPEC_LIST), ...validateSongs(), ...validateCourses()]
  if (errors.length) console.error('Module spec / preset / ready-to-play rig / catalog / lesson errors:\n' + errors.join('\n'))
  const layout = lintPanels()
  if (layout.length) console.warn('Panel layout problems (overlaps, alignment, screws):\n' + layout.join('\n'))
  const gaps = paramGaps(SPEC_LIST)
  if (gaps.length) console.warn('Knobs with no explanation (modules/paramGlossary.ts):\n' + gaps.join('\n'))
  Object.assign(window, { __voltage: { patchStore, actions, history, engine, telemetry } })
}

// A shared link (#p=…) opens in a scratch rack; if this page isn't one, it
// reloads as one and nothing else here needs to start.
if (!bootShared() && !bootCloud()) {
  initQwerty((ev) => engine.midi(ev))
  tutorial.boot() // opens a lesson if the URL names one (lessons run in a scratch rack)
  disableRackAutoscroll()
  initShortcuts()

  // No StrictMode: the audio engine is a singleton and must not double-boot.
  createRoot(document.getElementById('root')!).render(<App />)
}
