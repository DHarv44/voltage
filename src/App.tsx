import { GlobalDefs } from './ui/GlobalDefs'
import { Library } from './ui/Library'
import { Rack } from './ui/rack/Rack'
import { TopBar } from './ui/TopBar'
import { TutorialCard } from './ui/tutorial/TutorialCard'
import { TutorialBubble } from './ui/tutorial/TutorialBubble'

export function App() {
  return (
    <div className="app">
      <GlobalDefs />
      <TopBar />
      <TutorialCard />
      <div className="main">
        <Library />
        <Rack />
      </div>
      <TutorialBubble />
    </div>
  )
}
