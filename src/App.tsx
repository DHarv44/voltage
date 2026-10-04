import { GlobalDefs } from './ui/GlobalDefs'
import { Library } from './ui/Library'
import { Rack } from './ui/rack/Rack'
import { TopBar } from './ui/TopBar'

export function App() {
  return (
    <div className="app">
      <GlobalDefs />
      <TopBar />
      <div className="main">
        <Library />
        <Rack />
      </div>
    </div>
  )
}
