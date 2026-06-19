import { useState, useEffect, useMemo } from 'react'

// Searchable Multi-Select Dropdown Component
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
      <label onClick={() => setIsOpen(!isOpen)} style={{cursor: 'pointer'}}>
        {label} ({selected.length}) {isOpen ? '▲' : '▼'}
      </label>
      {isOpen && (
        <div className="dropdown-panel">
          <input type="text" placeholder="Keresés..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          <div className="options-list">
            {filteredOptions.map(opt => (
              <label key={opt} className="option-item">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [allMedia, setAllMedia] = useState([])
  const [extData, setExtData] = useState({})
  const [loading, setLoading] = useState(true)
  
  const [view, setView] = useState('browse') // 'browse' or 'library'
  const [library, setLibrary] = useState(() => JSON.parse(localStorage.getItem('mediaLibrary') || '[]'))
  const [modalItem, setModalItem] = useState(null)
  const [recommendations, setRecommendations] = useState([])

  const [filters, setFilters] = useState({
    types: [],
    pacings: [],
    genres: [],
    tags: [],
    tagLogic: 'OR', // 'AND' or 'OR'
    search: ''
  })

  // Adatok betöltése
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

  // Library mentése localStorage-ba
  useEffect(() => {
    localStorage.setItem('mediaLibrary', JSON.stringify(library))
  }, [library])

  // Összes elérhető műfaj és tag kinyerése a dropdownokhoz
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
    
    // Gyűjtjük a forrás tageket
    const sourceTags = new Set()
    sourceItems.forEach(item => {
      extData[item.id]?.tags.forEach(t => sourceTags.add(t))
    })

    // Pontozás
    const scored = allMedia.map(item => {
      if (sourceItems.find(s => s.id === item.id)) return null // Saját magát ne ajánlja
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
    setModalItem(null) // Bezárjuk a modalt
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

  // Szűrt lista
  const filteredMedia = useMemo(() => {
    return allMedia.filter(item => {
      const ext = extData[item.id] || { tags: [], pacing: 'Ismeretlen' }
      
      if (filters.search && !item.title.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.types.length > 0 && !filters.types.includes(item.type)) return false
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
    }).slice(0, 100)
  }, [allMedia, extData, filters])

  if (loading) return <div className="container"><h2>Adatok betöltése...</h2></div>

  return (
    <div className="container">
      <nav className="main-nav">
        <button onClick={() => setView('browse')} className={view === 'browse' ? 'active' : ''}>Böngészés</button>
        <button onClick={() => setView('library')} className={view === 'library' ? 'active' : ''}>Saját Könyvtár ({library.length})</button>
      </nav>

      {view === 'browse' && (
        <>
          <div className="filters">
            <input type="text" placeholder="Cím keresése..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
            
            <div className="checkbox-group">
              <span>Típus:</span>
              {['film', 'jatek', 'konyv', 'anime', 'manga'].map(t => (
                <label key={t}><input type="checkbox" checked={filters.types.includes(t)} onChange={() => toggleArrayFilter('types', t)} />{t}</label>
              ))}
            </div>

            <div className="checkbox-group">
              <span>Tempó:</span>
              {['Gyors', 'Közepes', 'Lassú'].map(p => (
                <label key={p}><input type="checkbox" checked={filters.pacings.includes(p)} onChange={() => toggleArrayFilter('pacings', p)} />{p}</label>
              ))}
            </div>

            <MultiSelect label="Műfajok" options={allGenres} selected={filters.genres} onChange={(arr) => setFilters({...filters, genres: arr})} />
            <MultiSelect label="Specifikus Tagek" options={allTags} selected={filters.tags} onChange={(arr) => setFilters({...filters, tags: arr})} />
            
            <div className="logic-switch">
              <label><input type="radio" checked={filters.tagLogic === 'OR'} onChange={() => setFilters({...filters, tagLogic: 'OR'})} /> VAGY</label>
              <label><input type="radio" checked={filters.tagLogic === 'AND'} onChange={() => setFilters({...filters, tagLogic: 'AND'})} /> ÉS</label>
            </div>
          </div>

          {recommendations.length > 0 && (
            <div className="recommendations-section">
              <h2>📎 Ajánlott művek</h2>
              <button className="clear-btn" onClick={() => setRecommendations([])}>X Ajánlások törlése</button>
              <div className="grid">
                {recommendations.map(item => (
                  <MediaCard key={item.id} item={item} ext={extData[item.id]} onOpen={setModalItem} onAdd={addToLibrary} isLib={library.includes(item.id)} />
                ))}
              </div>
              <hr style={{margin: '20px 0', borderColor: '#444'}}/>
            </div>
          )}

          <h2>Találatok ({filteredMedia.length})</h2>
          <div className="grid">
            {filteredMedia.map(item => (
              <MediaCard key={item.id} item={item} ext={extData[item.id]} onOpen={setModalItem} onAdd={addToLibrary} isLib={library.includes(item.id)} />
            ))}
          </div>
        </>
      )}

      {view === 'library' && (
        <>
          <h2>Saját Könyvtár</h2>
          {library.length > 0 && <button className="btn-recommend-large" onClick={handleLibraryRecommend}>💡 Ajánlj a könyvtáram alapján!</button>}
          
          {recommendations.length > 0 && (
            <div className="recommendations-section">
              <h3>Könyvtár alapján ajánlott:</h3>
              <div className="grid">
                {recommendations.map(item => (
                  <MediaCard key={item.id} item={item} ext={extData[item.id]} onOpen={setModalItem} onAdd={addToLibrary} isLib={library.includes(item.id)} />
                ))}
              </div>
              <hr style={{margin: '20px 0', borderColor: '#444'}}/>
            </div>
          )}

          {library.length === 0 ? <p>Még nem adtál hozzá semmit. Kattints a művekre a részletek nézetben!</p> : (
            <div className="grid">
              {allMedia.filter(m => library.includes(m.id)).map(item => (
                <div key={item.id} className="card">
                  <h3>{item.title}</h3>
                  <button className="btn-remove" onClick={() => removeFromLibrary(item.id)}>Eltávolít</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {modalItem && (
        <div className="modal-overlay" onClick={() => setModalItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalItem(null)}>X</button>
            <div className="modal-body">
              {modalItem.image && <img src={modalItem.image} alt={modalItem.title} className="modal-img" />}
              <div className="modal-info">
                <h2>{modalItem.title}</h2>
                <p><strong>Típus:</strong> {modalItem.type}</p>
                <p><strong>Tempó:</strong> {extData[modalItem.id]?.pacing}</p>
                {modalItem.author && <p><strong>Szerző:</strong> {modalItem.author}</p>}
                <p>{modalItem.description}</p>
                <div className="tag-container">
                  {extData[modalItem.id]?.tags.map((tag, i) => <span key={i} className="tag">{tag}</span>)}
                </div>
                <div className="modal-actions">
                  <button className="btn-recommend" onClick={() => handleRecommend(modalItem)}>Hasonlót kérek!</button>
                  {!library.includes(modalItem.id) ? (
                    <button className="btn-add" onClick={() => { addToLibrary(modalItem.id); setModalItem(null) }}>Könyvtárba</button>
                  ) : (
                    <button className="btn-remove" onClick={() => { removeFromLibrary(modalItem.id); setModalItem(null) }}>Eltávolít</button>
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

function MediaCard({ item, ext, onOpen, onAdd, isLib }) {
  return (
    <div className="card" onClick={() => onOpen(item)}>
      {item.image ? <img src={item.image} alt={item.title} className="card-img" /> : <div className="no-img">Nincs kép</div>}
      <h3>{item.title}</h3>
      <p><strong>Típus:</strong> {item.type} | <strong>Tempó:</strong> {ext?.pacing || '?'}</p>
      <div className="tag-container">
        {ext?.tags.slice(0, 3).map((tag, i) => <span key={i} className="tag">{tag}</span>)}
      </div>
      <button className="btn-add" onClick={(e) => { e.stopPropagation(); onAdd(item.id) }} disabled={isLib}>
        {isLib ? '✔ Hozzáadva' : '+ Könyvtár'}
      </button>
    </div>
  )
}
