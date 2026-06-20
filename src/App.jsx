import { useState, useEffect, useMemo } from 'react'

const dict = {
  hu: {
    browse: "Böngészés", library: "Könyvtár", searchPh: "🔍 Cím keresése...",
    type: "Típus", pacing: "Tempó", ageRating: "Korhatár", genres: "Műfajok", tags: "Specifikus Tagek",
    logic: "Kapcsolat", sortBy: "Rendezés", popularity: "Népszerűség",
    az: "Cím (A-Z)", za: "Cím (Z-A)", dateDesc: "Megjelenés (Újabbak előbb)", dateAsc: "Megjelenés (Régebbiek előbb)",
    recommended: "✨ Ajánlott művek", clear: "Törlés ✖", results: "Találatok",
    loadMore: (c) => `Továbbiak betöltése (${c} elem rejtve)`, myLibrary: "Saját Könyvtár",
    libRecBtn: "💡 Ajánlj a könyvtáram alapján!", libRecHeader: "✨ Könyvtár alapján ajánlott",
    emptyLib: "A könyvtárad még üres. Kattints egy kártyára, majd a \"+ Könyvtárba\" gombra a hozzáadáshoz!",
    remove: "Eltávolít", pacingWord: "tempó", noDesc: "Nincs elérhető leírás.",
    findSimilar: "✨ Hasonlót kérek!", addToLib: "+ Könyvtárba", removeFromLib: "- Eltávolít",
    saved: "✔ Mentve", noImg: "Nincs kép", loading: "Adatok betöltése...",
    nsfwWarning: "18+ Képtartalom", clickReveal: "Kattints a felfedésért",
    types: { film: "film", jatek: "játék", konyv: "könyv", anime: "anime", manga: "manga", manhwa: "manhwa" },
    pacings: { Gyors: "Gyors", Közepes: "Közepes", Lassú: "Lassú" }
  },
  en: {
    browse: "Browse", library: "Library", searchPh: "🔍 Search title...",
    type: "Type", pacing: "Pacing", ageRating: "Age Rating", genres: "Genres", tags: "Specific Tags",
    logic: "Logic", sortBy: "Sort by", popularity: "Popularity",
    az: "Title (A-Z)", za: "Title (Z-A)", dateDesc: "Release (Newest)", dateAsc: "Release (Oldest)",
    recommended: "✨ Recommended", clear: "Clear ✖", results: "Results",
    loadMore: (c) => `Load more (${c} items hidden)`, myLibrary: "My Library",
    libRecBtn: "💡 Recommend based on my library!", libRecHeader: "✨ Library-based recommendations",
    emptyLib: "Your library is empty. Click a card, then \"+ Add to Library\" to add!",
    remove: "Remove", pacingWord: "pacing", noDesc: "No description available.",
    findSimilar: "✨ Find similar!", addToLib: "+ Add to Library", removeFromLib: "- Remove",
    saved: "✔ Saved", noImg: "No image", loading: "Loading data...",
    nsfwWarning: "18+ Image Content", clickReveal: "Click to reveal",
    types: { film: "Movie", jatek: "Game", konyv: "Book", anime: "Anime", manga: "Manga", manhwa: "Manhwa" },
    pacings: { Gyors: "Fast", Közepes: "Medium", Lassú: "Slow" }
  }
}

function MultiSelect({ label, options, selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()))
  const toggleOption = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(o => o !== opt))
    else onChange([...selected, opt])
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

// Képet megjelenítő komponens (NSFW homályosítással)
function CoverImage({ item, t, revealed, onReveal, className, noImgClass }) {
  if (!item.image) return <div className={noImgClass}>{t.noImg}</div>
  
  if (item.cover_nsfw && !revealed) {
    return (
      <div className="nsfw-cover" onClick={(e) => { e.stopPropagation(); onReveal(item.id) }}>
        <img src={item.image} alt={item.title_en} className={`${className} blurred`} />
        <div className="nsfw-overlay">
          <span className="nsfw-icon">🔞</span>
          <span className="nsfw-text">{t.nsfwWarning}</span>
          <span className="nsfw-click">{t.clickReveal}</span>
        </div>
      </div>
    )
  }
  return <img src={item.image} alt={item.title_en} className={className} />
}

export default function App() {
  const [allMedia, setAllMedia] = useState([])
  const [extData, setExtData] = useState({})
  const [loading, setLoading] = useState(true)
  
  const [view, setView] = useState('browse')
  const [lang, setLang] = useState('hu')
  const [sortBy, setSortBy] = useState('popularity')
  const [revealedImages, setRevealedImages] = useState(new Set()) // Nyitott 18+ képek
  
  const [library, setLibrary] = useState(() => JSON.parse(localStorage.getItem('mediaLibrary') || '[]'))
  const [modalItem, setModalItem] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [visibleCount, setVisibleCount] = useState(50)

  const [filters, setFilters] = useState({
    types: [], pacings: [], ageRatings: [], genres: [], tags: [], tagLogic: 'OR', search: ''
  })

  const t = dict[lang]

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
            if (key === 'bovitett') data.forEach(item => extMap[item.id] = item)
            else mediaArray = [...mediaArray, ...data]
          }
        }
        setAllMedia(mediaArray)
        setExtData(extMap)
      } catch (err) { console.error("Hiba:", err) } finally { setLoading(false) }
    }
    loadData()
  }, [])

  useEffect(() => { localStorage.setItem('mediaLibrary', JSON.stringify(library)) }, [library])
  useEffect(() => { setVisibleCount(50) }, [filters, lang, sortBy])

  const getTitle = (item) => {
    if (!item) return '';
    if (lang === 'en') return item.title_en || item.title_hu || 'No title'
    return item.title_hu || item.title_en || 'Nincs cím'
  }

  const allGenres = useMemo(() => {
    let set = new Set(); allMedia.forEach(m => m.genres?.forEach(g => set.add(g))); return Array.from(set).sort()
  }, [allMedia])

  const allTags = useMemo(() => {
    let set = new Set(); Object.values(extData).forEach(e => e.tags?.forEach(t => set.add(t))); return Array.from(set).sort()
  }, [extData])

  const toggleArrayFilter = (key, value) => {
    setFilters(prev => {
      const arr = prev[key]
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  const toggleReveal = (id) => {
    setRevealedImages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const getRecommendations = (sourceItems) => {
    if (sourceItems.length === 0) return []
    const sourceTags = new Set()
    sourceItems.forEach(item => extData[item.id]?.tags.forEach(tag => sourceTags.add(tag)))
    return allMedia.map(item => {
      if (sourceItems.find(s => s.id === item.id)) return null
      let score = 0
      extData[item.id]?.tags.forEach(tag => { if (sourceTags.has(tag)) score++ })
      return { ...item, _score: score }
    }).filter(item => item && item._score > 0).sort((a, b) => b._score - a._score).slice(0, 12)
  }

  const handleRecommend = (item) => {
    setRecommendations(getRecommendations([item])); setModalItem(null); setView('browse')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleLibraryRecommend = () => setRecommendations(getRecommendations(allMedia.filter(m => library.includes(m.id))))
  const addToLibrary = (id) => { if (!library.includes(id)) setLibrary([...library, id]) }
  const removeFromLibrary = (id) => setLibrary(library.filter(libId => libId !== id))

  const filteredMedia = useMemo(() => {
    let result = allMedia.filter(item => {
      const ext = extData[item.id] || { tags: [], pacing: 'Közepes' }
      if (filters.search && !getTitle(item).toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.types.length > 0 && (!item.type || !filters.types.includes(item.type))) return false
      if (filters.pacings.length > 0 && !filters.pacings.includes(ext.pacing)) return false
      if (filters.ageRatings.length > 0 && !filters.ageRatings.includes(item.age_rating || 'Unknown')) return false
      if (filters.genres.length > 0 && !filters.genres.some(g => item.genres?.includes(g))) return false
      if (filters.tags.length > 0) {
        if (filters.tagLogic === 'AND' && !filters.tags.every(t => ext.tags.includes(t))) return false
        if (filters.tagLogic === 'OR' && !filters.tags.some(t => ext.tags.includes(t))) return false
      }
      return true
    })

    result.sort((a, b) => {
      if (sortBy === 'az') return getTitle(a).localeCompare(getTitle(b))
      if (sortBy === 'za') return getTitle(b).localeCompare(getTitle(a))
      if (sortBy === 'date_desc') return (b.date || '').localeCompare(a.date || '')
      if (sortBy === 'date_asc') return (a.date || '').localeCompare(b.date || '')
      return (b.score || 0) - (a.score || 0)
    })
    return result
  }, [allMedia, extData, filters, lang, sortBy])

  const displayedMedia = filteredMedia.slice(0, visibleCount)
  if (loading) return <div className="container loading-screen"><h2>{t.loading}</h2></div>

  return (
    <div className="app-wrapper">
      <header className="main-header">
        <div className="container header-inner">
          <h1>Média<span>Bázis</span></h1>
          <div className="header-controls">
            <button className="lang-btn" onClick={() => setLang(lang === 'hu' ? 'en' : 'hu')}>{lang === 'hu' ? 'HU' : 'EN'}</button>
            <nav className="main-nav">
              <button onClick={() => setView('browse')} className={view === 'browse' ? 'active' : ''}>{t.browse}</button>
              <button onClick={() => setView('library')} className={view === 'library' ? 'active' : ''}>{t.library} ({library.length})</button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container">
        {view === 'browse' && (
          <>
            <div className="filters-panel glass-card">
              <div className="filter-row">
                <input type="text" className="search-bar" placeholder={t.searchPh} value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
              </div>
              
              <div className="filter-group">
                <span className="filter-label">{t.type}</span>
                <div className="pills-container">
                  {['film', 'jatek', 'konyv', 'anime', 'manga', 'manhwa'].map(typ => (
                    <button key={typ} className={`pill ${filters.types.includes(typ) ? 'active' : ''}`} onClick={() => toggleArrayFilter('types', typ)}>{t.types[typ]}</button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label">{t.pacing}</span>
                <div className="pills-container">
                  {['Gyors', 'Közepes', 'Lassú'].map(p => (
                    <button key={p} className={`pill ${filters.pacings.includes(p) ? 'active' : ''}`} onClick={() => toggleArrayFilter('pacings', p)}>{t.pacings[p]}</button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label">{t.ageRating}</span>
                <div className="pills-container">
                  {['12+', '16+', 'Unknown'].map(a => (
                    <button key={a} className={`pill ${filters.ageRatings.includes(a) ? 'active' : ''}`} onClick={() => toggleArrayFilter('ageRatings', a)}>{a === 'Unknown' ? '?' : a}</button>
                  ))}
                </div>
              </div>

              <div className="filter-row multi-row">
                <MultiSelect label={t.genres} options={allGenres} selected={filters.genres} onChange={(arr) => setFilters({...filters, genres: arr})} />
                <MultiSelect label={t.tags} options={allTags} selected={filters.tags} onChange={(arr) => setFilters({...filters, tags: arr})} />
                <div className="logic-switch">
                  <span className="filter-label">{t.logic}</span>
                  <div className="pills-container">
                    <button className={`pill ${filters.tagLogic === 'OR' ? 'active' : ''}`} onClick={() => setFilters({...filters, tagLogic: 'OR'})}>OR</button>
                    <button className={`pill ${filters.tagLogic === 'AND' ? 'active' : ''}`} onClick={() => setFilters({...filters, tagLogic: 'AND'})}>AND</button>
                  </div>
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label">{t.sortBy}</span>
                <select className="sort-dropdown" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="popularity">{t.popularity}</option>
                  <option value="az">{t.az}</option>
                  <option value="za">{t.za}</option>
                  <option value="date_desc">{t.dateDesc}</option>
                  <option value="date_asc">{t.dateAsc}</option>
                </select>
              </div>
            </div>

            {recommendations.length > 0 && (
              <div className="recommendations-section glass-card">
                <div className="section-header">
                  <h2>{t.recommended}</h2>
                  <button className="clear-btn" onClick={() => setRecommendations([])}>{t.clear}</button>
                </div>
                <div className="grid">
                  {recommendations.map(item => (
                    <MediaCard key={item.id} t={t} item={item} title={getTitle(item)} ext={extData[item.id]} onOpen={setModalItem} onAdd={addToLibrary} isLib={library.includes(item.id)} revealed={revealedImages.has(item.id)} onReveal={toggleReveal} />
                  ))}
                </div>
              </div>
            )}

            <div className="results-header">
              <h2>{t.results} <span className="result-count">({filteredMedia.length})</span></h2>
            </div>
            
            <div className="grid">
              {displayedMedia.map(item => (
                <MediaCard key={item.id} t={t} item={item} title={getTitle(item)} ext={extData[item.id]} onOpen={setModalItem} onAdd={addToLibrary} isLib={library.includes(item.id)} revealed={revealedImages.has(item.id)} onReveal={toggleReveal} />
              ))}
            </div>
            
            {visibleCount < filteredMedia.length && (
              <div className="load-more-container">
                <button className="load-more-btn" onClick={() => setVisibleCount(prev => prev + 50)}>{t.loadMore(filteredMedia.length - visibleCount)}</button>
              </div>
            )}
          </>
        )}

        {view === 'library' && (
          <>
            <div className="library-header">
              <h2>{t.myLibrary}</h2>
              {library.length > 0 && <button className="btn-recommend-large" onClick={handleLibraryRecommend}>{t.libRecBtn}</button>}
            </div>
            
            {recommendations.length > 0 && (
              <div className="recommendations-section glass-card">
                <div className="section-header">
                  <h2>{t.libRecHeader}</h2>
                  <button className="clear-btn" onClick={() => setRecommendations([])}>{t.clear}</button>
                </div>
                <div className="grid">
                  {recommendations.map(item => (
                    <MediaCard key={item.id} t={t} item={item} title={getTitle(item)} ext={extData[item.id]} onOpen={setModalItem} onAdd={addToLibrary} isLib={library.includes(item.id)} revealed={revealedImages.has(item.id)} onReveal={toggleReveal} />
                  ))}
                </div>
              </div>
            )}

            {library.length === 0 ? (
              <div className="empty-state glass-card"><p>{t.emptyLib}</p></div>
            ) : (
              <div className="grid">
                {allMedia.filter(m => library.includes(m.id)).map(item => (
                  <div key={item.id} className="card lib-card">
                    <CoverImage item={item} t={t} revealed={revealedImages.has(item.id)} onReveal={toggleReveal} className="card-img" noImgClass="no-img" />
                    <div className="card-content">
                      <h3>{getTitle(item)}</h3>
                      <button className="btn-remove" onClick={() => removeFromLibrary(item.id)}>{t.remove}</button>
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
                <CoverImage item={modalItem} t={t} revealed={revealedImages.has(modalItem.id)} onReveal={toggleReveal} className="modal-img" noImgClass="no-img" />
              </div>
              <div className="modal-info">
                <h2>{getTitle(modalItem)}</h2>
                <div className="modal-meta">
                  <span className="meta-badge">{t.types[modalItem.type]}</span>
                  <span className="meta-badge">{t.pacings[extData[modalItem.id]?.pacing]} {t.pacingWord}</span>
                  {modalItem.age_rating && <span className="meta-badge">🔴 {modalItem.age_rating}</span>}
                  {modalItem.author && <span className="meta-badge">{modalItem.author}</span>}
                  {modalItem.date && <span className="meta-badge">{modalItem.date}</span>}
                </div>
                <p className="modal-desc">{modalItem.description || t.noDesc}</p>
                <div className="tag-container">
                  {extData[modalItem.id]?.tags.map((tag, i) => <span key={i} className="tag">{tag}</span>)}
                </div>
                <div className="modal-actions">
                  <button className="btn-recommend" onClick={() => handleRecommend(modalItem)}>{t.findSimilar}</button>
                  {!library.includes(modalItem.id) ? (
                    <button className="btn-add" onClick={() => { addToLibrary(modalItem.id); setModalItem(null) }}>{t.addToLib}</button>
                  ) : (
                    <button className="btn-remove" onClick={() => { removeFromLibrary(modalItem.id); setModalItem(null) }}>{t.removeFromLib}</button>
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

function MediaCard({ t, item, title, ext, onOpen, onAdd, isLib, revealed, onReveal }) {
  return (
    <div className="card" onClick={() => onOpen(item)}>
      <CoverImage item={item} t={t} revealed={revealed} onReveal={onReveal} className="card-img" noImgClass="no-img" />
      <div className="card-content">
        <h3>{title}</h3>
        <div className="card-meta">
          <span>{t.types[item.type]}</span> • <span>{ext?.pacing ? t.pacings[ext.pacing] : '?'}</span>
        </div>
        <div className="tag-container">
          {ext?.tags.slice(0, 2).map((tag, i) => <span key={i} className="tag">{tag}</span>)}
        </div>
        <button className="btn-add" onClick={(e) => { e.stopPropagation(); onAdd(item.id) }} disabled={isLib}>
          {isLib ? t.saved : t.addToLib}
        </button>
      </div>
    </div>
  )
}
