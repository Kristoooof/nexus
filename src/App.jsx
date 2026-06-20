import { useState, useEffect, useMemo } from 'react'

function MultiSelect({ label, options, selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()))

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(o => o !== opt))
    } else {
      onChange([...selected, opt])
    }
  }

  return (
    <div className="multi-select">
      <button className="ms-button" onClick={() => setIsOpen(!isOpen)}>
        {label} {selected.length > 0 && <span className="ms-badge">{selected.length}</span>} {isOpen ? '▲' : '▼'}
      </button>
      {isOpen && (
        <>
          <div className="dropdown-overlay" onClick={() => setIsOpen(false)} />
          <div className="dropdown-panel">
            <input type="text" placeholder="Keresés..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            <div className="options-list">
              {filteredOptions.map(opt => (
                <label key={opt} className={`option-item ${selected.includes(opt) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function App() {
  const [allMedia, setAllMedia] = useState([])
  const [extData, setExtData] = useState({})
  const [loading, setLoading] = useState(true)
  
  const [view, setView] = useState('browse')
  const [lang, setLang] = useState('hu') // 'hu' vagy 'en'
  const [sortBy, setSortBy] = useState('popularity') // Új: Rendezés
  
  const [library, setLibrary] = useState(() => JSON.parse(localStorage.getItem('mediaLibrary') || '[]'))
  const [modalItem, setModalItem] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [visibleCount, setVisibleCount] = useState(50)

  const [filters, setFilters] = useState({
    types: [],
    pacings: [],
    genres: [],
    tags: [],
    tagLogic: 'OR',
    search: ''
  })

  useEffect(() => {
    async function loadData() {
      try {
        const manifestResp = await fetch('./manifest.json')
        const manifest = await manifestResp.json()
        let mediaArray = []
        let extMap = {}

        for (const key in manifest) {
          for (const file of manifest[key]) {
            const resp = await fetch(`./${file}`)
            const data = await resp.json()
            if (key === 'bovitett') {
              data.forEach(item => extMap[item.id] = item)
            } else {
              mediaArray = [...mediaArray, ...data]
            }
          }
        }
        setAllMedia(mediaArray)
        setExtData(extMap)
      } catch (err) {
        console.error("Hiba:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    localStorage.setItem('mediaLibrary', JSON.stringify(library))
  }, [library])

  useEffect(() => {
    setVisibleCount(50)
  }, [filters, lang, sortBy])

  const getTitle = (item) => {
    if (!item) return '';
    if (lang === 'en') return item.title_en || item.title_hu || item.title || 'Nincs cím'
    return item.title_hu || item.title_en || item.title || 'Nincs cím'
  }

  const allGenres = useMemo(() => {
    let set = new Set()
    allMedia.forEach(m => m.genres?.forEach(g => set.add(g)))
    return Array.from(set).sort()
  }, [allMedia])

  const allTags = useMemo(() => {
    let set = new Set()
    Object.values(extData).forEach(e => e.tags?.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [extData])

  const toggleArrayFilter = (key, value) => {
    setFilters(prev => {
      const arr = prev[key]
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  const getRecommendations = (sourceItems) => {
    if (sourceItems.length === 0) return []
    const sourceTags = new Set()
    sourceItems.forEach(item => {
      extData[item.id]?.tags.forEach(t => sourceTags.add(t))
    })

    const scored = allMedia.map(item => {
      if (sourceItems.find(s => s.id === item.id)) return null
      const itemTags = extData[item.id]?.tags || []
      let score = 0
      itemTags.forEach(t => { if (sourceTags.has(t)) score++ })
      return { ...item, _score: score }
    }).filter(item => item && item._score > 0)

    return scored.sort((a, b) => b._score - a._score).slice(0, 12)
  }

  const handleRecommend = (item) => {
    const recs = getRecommendations([item])
    setRecommendations(recs)
    setModalItem(null)
    setView('browse')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLibraryRecommend = () => {
    const libItems = allMedia.filter(m => library.includes(m.id))
    const recs = getRecommendations(libItems)
    setRecommendations(recs)
  }

  const addToLibrary = (id) => {
    if (!library.includes(id)) setLibrary([...library, id])
  }

  const removeFromLibrary = (id) => {
    setLibrary(library.filter(libId => libId !== id))
  }

  // Szűrés és Rendezés
  const filteredMedia = useMemo(() => {
    let result = allMedia.filter(item => {
      const ext = extData[item.id] || { tags: [], pacing: 'Ismeretlen' }
      
      const currentTitle = getTitle(item).toLowerCase()
      if (filters.search && !currentTitle.includes(filters.search.toLowerCase())) return false
      
      if (filters.types.length > 0) {
        if (!item.type || !filters.types.includes(item.type)) return false
      }
      if (filters.pacings.length > 0 && !filters.pacings.includes(ext.pacing)) return false
      if (filters.genres.length > 0) {
        const hasGenre = filters.genres.some(g => item.genres?.includes(g))
        if (!hasGenre) return false
      }
      if (filters.tags.length > 0) {
        if (filters.tagLogic === 'AND') {
          const hasAll = filters.tags.every(t => ext.tags.includes(t))
          if (!hasAll) return false
        } else {
          const hasSome = filters.tags.some(t => ext.tags.includes(t))
          if (!hasSome) return false
        }
      }
      return true
    })

    // Rendezés
    result.sort((a, b) => {
      if (sortBy === 'az') return getTitle(a).localeCompare(getTitle(b))
      if (sortBy === 'za') return getTitle(b).localeCompare(getTitle(a))
      if (sortBy === 'date_desc') return (b.date || '').localeCompare(a.date || '')
      if (sortBy === 'date_asc') return (a.date || '').localeCompare(b.date || '')
      // default: popularity (score)
      return (b.score || 0) - (a.score || 0)
    })

    return result
  }, [allMedia, extData, filters, lang, sortBy])

  const displayedMedia = filteredMedia.slice(0, visibleCount)

  if (loading) return <div className="container loading-screen"><h2>Adatok betöltése...</h2></div>

  return (
    <div className="app-wrapper">
      <header className="main-header">
        <div className="container header-inner">
          <h1>Média<span>Bázis</span></h1>
          <div className="header-controls">
            <button className="lang-btn" onClick={() => setLang(lang === 'hu' ? 'en' : 'hu')}>
              {lang === 'hu' ? 'HU' : 'EN'}
            </button>
            <nav className="main-nav">
              <button onClick={() => setView('browse')} className={view === 'browse' ? 'active' : ''}>Böngészés</button>
              <button onClick={() => setView('library')} className={view === 'library' ? 'active' : ''}>Könyvtár ({library.length})</button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container">
        {view === 'browse' && (
          <>
            <div className="filters-panel glass-card">
              <div className="filter-row">
                <input type="text" className="search-bar" placeholder="🔍 Cím keresése..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
              </div>
              
              <div className="filter-group">
                <span className="filter-label">Típus</span>
                <div className="pills-container">
                  {['film', 'jatek', 'konyv', 'anime', 'manga', 'manhwa'].map(t => (
                    <button key={t} className={`pill ${filters.types.includes(t) ? 'active' : ''}`} onClick={() => toggleArrayFilter('types', t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label">Tempó</span>
                <div className="pills-container">
                  {['Gyors', 'Közepes', 'Lassú'].map(p => (
                    <button key={p} className={`pill ${filters.pacings.includes(p) ? 'active' : ''}`} onClick={() => toggleArrayFilter('pacings', p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-row multi-row">
                <MultiSelect label="Műfajok" options={allGenres} selected={filters.genres} onChange={(arr) => setFilters({...filters, genres: arr})} />
                <MultiSelect label="Specifikus Tagek" options={allTags} selected={filters.tags} onChange={(arr) => setFilters({...filters, tags: arr})} />
                
                <div className="logic-switch">
                  <span className="filter-label">Kapcsolat</span>
                  <div className="pills-container">
                    <button className={`pill ${filters.tagLogic === 'OR' ? 'active' : ''}`} onClick={() => setFilters({...filters, tagLogic: 'OR'})}>VAGY</button>
                    <button className={`pill ${filters.tagLogic === 'AND' ? 'active' : ''}`} onClick={() => setFilters({...filters, tagLogic: 'AND'})}>ÉS</button>
                  </div>
                </div>
              </div>

              {/* ÚJ: Rendezés */}
              <div className="filter-group">
                <span className="filter-label">Rendezés</span>
                <select className="sort-dropdown" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="popularity">Népszerűség</option>
                  <option value="az">Cím (A-Z)</option>
                  <option value="za">Cím (Z-A)</option>
                  <option value="date_desc">Megjelenés (Újabbak előbb)</option>
                  <option value="date_asc">Megjelenés (Régebbiek előbb)</option>
                </select>
              </div>
            </div>

            {recommendations.length > 0 && (
              <div className="recommendations-section glass-card">
                <div className="section-header">
                  <h2>✨ Ajánlott művek</h2>
                  <button className="clear-btn" onClick={() => setRecommendations([])}>Törlés ✖</button>
                </div>
                <div className="grid">
                  {recommendations.map(item => (
                    <MediaCard key={item.id} item={item} title={getTitle(item)} ext={extData[item.id]} onOpen={setModalItem} onAdd={addToLibrary} isLib={library.includes(item.id)} />
                  ))}
                </div>
              </div>
            )}

            <div className="results-header">
              <h2>Találatok <span className="result-count">({filteredMedia.length})</span></h2>
            </div>
            
            <div className="grid">
              {displayedMedia.map(item => (
                <MediaCard key={item.id} item={item} title={getTitle(item)} ext={extData[item.id]} onOpen={setModalItem} onAdd={addToLibrary} isLib={library.includes(item.id)} />
              ))}
            </div>
            
            {visibleCount < filteredMedia.length && (
              <div className="load-more-container">
                <button className="load-more-btn" onClick={() => setVisibleCount(prev => prev + 50)}>
                  Továbbiak betöltése ({filteredMedia.length - visibleCount} elem rejtve)
                </button>
              </div>
            )}
          </>
        )}

        {view === 'library' && (
          <>
            <div className="library-header">
              <h2>Saját Könyvtár</h2>
              {library.length > 0 && <button className="btn-recommend-large" onClick={handleLibraryRecommend}>💡 Ajánlj a könyvtáram alapján!</button>}
            </div>
            
            {recommendations.length > 0 && (
              <div className="recommendations-section glass-card">
                <div className="section-header">
                  <h2>✨ Könyvtár alapján ajánlott</h2>
                  <button className="clear-btn" onClick={() => setRecommendations([])}>Törlés ✖</button>
                </div>
                <div className="grid">
                  {recommendations.map(item => (
                    <MediaCard key={item.id} item={item} title={getTitle(item)} ext={extData[item.id]} onOpen={setModalItem} onAdd={addToLibrary} isLib={library.includes(item.id)} />
                  ))}
                </div>
              </div>
            )}

            {library.length === 0 ? (
              <div className="empty-state glass-card">
                <p>A könyvtárad még üres. Kattints egy kártyára, majd a "Könyvtárba" gombra a hozzáadáshoz!</p>
              </div>
            ) : (
              <div className="grid">
                {allMedia.filter(m => library.includes(m.id)).map(item => (
                  <div key={item.id} className="card lib-card">
                    {item.image ? <img src={item.image} alt={getTitle(item)} className="card-img" /> : <div className="no-img">Nincs kép</div>}
                    <div className="card-content">
                      <h3>{getTitle(item)}</h3>
                      <button className="btn-remove" onClick={() => removeFromLibrary(item.id)}>Eltávolít</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {modalItem && (
        <div className="modal-overlay" onClick={() => setModalItem(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalItem(null)}>✖</button>
            <div className="modal-body">
              <div className="modal-img-wrap">
                {modalItem.image ? <img src={modalItem.image} alt={getTitle(modalItem)} className="modal-img" /> : <div className="no-img">Nincs kép</div>}
              </div>
              <div className="modal-info">
                <h2>{getTitle(modalItem)}</h2>
                <div className="modal-meta">
                  <span className="meta-badge">{modalItem.type}</span>
                  <span className="meta-badge">{extData[modalItem.id]?.pacing} tempó</span>
                  {modalItem.author && <span className="meta-badge">{modalItem.author}</span>}
                  {modalItem.date && <span className="meta-badge">{modalItem.date}</span>}
                </div>
                <p className="modal-desc">{modalItem.description || 'Nincs elérhető leírás.'}</p>
                <div className="tag-container">
                  {extData[modalItem.id]?.tags.map((tag, i) => <span key={i} className="tag">{tag}</span>)}
                </div>
                <div className="modal-actions">
                  <button className="btn-recommend" onClick={() => handleRecommend(modalItem)}>✨ Hasonlót kérek!</button>
                  {!library.includes(modalItem.id) ? (
                    <button className="btn-add" onClick={() => { addToLibrary(modalItem.id); setModalItem(null) }}>+ Könyvtárba</button>
                  ) : (
                    <button className="btn-remove" onClick={() => { removeFromLibrary(modalItem.id); setModalItem(null) }}>- Eltávolít</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MediaCard({ item, title, ext, onOpen, onAdd, isLib }) {
  return (
    <div className="card" onClick={() => onOpen(item)}>
      {item.image ? <img src={item.image} alt={title} className="card-img" /> : <div className="no-img">Nincs kép</div>}
      <div className="card-content">
        <h3>{title}</h3>
        <div className="card-meta">
          <span>{item.type}</span> • <span>{ext?.pacing || '?'}</span>
        </div>
        <div className="tag-container">
          {ext?.tags.slice(0, 2).map((tag, i) => <span key={i} className="tag">{tag}</span>)}
        </div>
        <button className="btn-add" onClick={(e) => { e.stopPropagation(); onAdd(item.id) }} disabled={isLib}>
          {isLib ? '✔ Mentve' : '+ Könyvtár'}
        </button>
      </div>
    </div>
  )
}
