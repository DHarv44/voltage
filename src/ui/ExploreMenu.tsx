import { useState } from 'react'
import { engine } from '../audio/engine'
import { rackName } from '../patch/rackName'
import { PRESETS } from '../patch/presets'
import { buildSong, SONGS, type Song } from '../patch/songs'
import { actions } from '../patch/store'
import type { Patch } from '../patch/types'
import { BrowsePanel } from './cloud/BrowsePanel'
import { toast } from './Toast'
import { usePopover } from './usePopover'

type Tab = 'songs' | 'racks' | 'gallery'

/** Explore: things to load and pull apart. Whole songs in the style of an
 *  era, example racks, and the gallery of racks people have shared. Loading
 *  one replaces your rack (Ctrl+Z brings it back). */
export function ExploreMenu() {
  const pop = usePopover()
  const [tab, setTab] = useState<Tab>('songs')

  const load = (p: Patch, name: string, how: string) => {
    actions.load(structuredClone(p))
    rackName.set(name)
    pop.setOpen(false)
    const power = engine.getStatus().power ? '' : ' Switch POWER on to hear it.'
    toast.show(name, `${how}${power} (Ctrl+Z brings your rack back.)`)
  }
  const song = (s: Song) => load(buildSong(s), `${s.name} (${s.year})`, s.howTo)

  return (
    <div className="preset-menu" ref={pop.root}>
      <button className={pop.open ? 'active' : ''} onClick={pop.toggle} title="Songs, example racks and the gallery: load one and pull it apart">
        Explore ▾
      </button>
      {pop.open && (
        <div className="preset-list cloud-panel explore-panel" style={{ right: 0 }}>
          <div className="cloud-tabs">
            <button className={tab === 'songs' ? 'on' : ''} onClick={() => setTab('songs')}>
              Songs
            </button>
            <button className={tab === 'racks' ? 'on' : ''} onClick={() => setTab('racks')}>
              Example racks
            </button>
            <button className={tab === 'gallery' ? 'on' : ''} onClick={() => setTab('gallery')}>
              Gallery
            </button>
          </div>
          {tab === 'songs' && (
            <div className="cloud-list">
              <div className="preset-group">The sound of an era · our own notes</div>
              {SONGS.map((s) => (
                <button key={s.id} className="preset-item" onClick={() => song(s)}>
                  <span className="preset-name">
                    <span className="song-year">{s.year}</span> {s.name}
                  </span>
                  <span className="preset-desc">{s.era}</span>
                </button>
              ))}
            </div>
          )}
          {tab === 'racks' && (
            <div className="cloud-list">
              {PRESETS.map((p) => (
                <button key={p.id} className="preset-item" onClick={() => load(p.build(), p.name, p.howTo)}>
                  <span className="preset-name">{p.name}</span>
                  <span className="preset-desc">{p.description}</span>
                </button>
              ))}
            </div>
          )}
          {tab === 'gallery' && <BrowsePanel />}
        </div>
      )}
    </div>
  )
}
