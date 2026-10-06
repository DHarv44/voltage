import { GlobalDefs } from './ui/GlobalDefs'
import { Library } from './ui/Library'
import { Rack } from './ui/rack/Rack'
import { TopBar } from './ui/TopBar'
import { TutorialCard } from './ui/tutorial/TutorialCard'
import { SharedBanner } from './ui/share/SharedBanner'
import { TutorialBubble } from './ui/tutorial/TutorialBubble'
import { Toast } from './ui/Toast'

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
      </div>
      <TutorialBubble />
      <Toast />
    </div>
  )
}
