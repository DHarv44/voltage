import { GlobalDefs } from './ui/GlobalDefs'
import { Library } from './ui/Library'
import { Rack } from './ui/rack/Rack'
import { TopBar } from './ui/TopBar'
import { TutorialCard } from './ui/tutorial/TutorialCard'
import { SharedBanner } from './ui/share/SharedBanner'
import { TutorialBubble } from './ui/tutorial/TutorialBubble'
import { Toast } from './ui/Toast'
import { StartScreen } from './ui/StartScreen'
import { Inspector } from './ui/inspector/Inspector'

export function App() {
  return (
    <div className="app">
      <GlobalDefs />
      <TopBar />
      <SharedBanner />
      <TutorialCard />
      <div className="main">
        <Library />
        <Rack />
        <Inspector />
      </div>
      <TutorialBubble />
      <Toast />
      <StartScreen />
    </div>
  )
}
