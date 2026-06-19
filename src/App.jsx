import { useState, useEffect } from 'react'

export default function App() {
  const [allMedia, setAllMedia] = useState([])
  const [extendedData, setExtendedData] = useState({})
  const [loading, setLoading] = useState(true)
  
  const [filters, setFilters] = useState({
    type: '',
    genre: '',
    tag: '',
    pacing: '',
    search: ''
  })
  
  const [recommendBase, setRecommendBase] = useState(null)

  // Adatok betöltése a JSON fájlokból
  useEffect(() => {
    async function loadData() {
      try {
        // Manifest betöltése
        const manifestResp = await fetch('./manifest.json')
        const manifest = await manifestResp.json()
        
        let mediaArray = []
        
        // Összes adatfájl betöltése
        for (const key in manifest) {
          if (key === 'bovitett') continue
          for (const file of manifest[key]) {
            const resp = await fetch(`./${file}`)
            const data = await resp.json()
            mediaArray = [...mediaArray, ...data]
          }
        }
        setAllMedia(mediaArray)
        
        // Bővített adatok betöltése (id -> {tags, pacing})
        let extMap = {}
        for (const file of manifest['bovitett']) {
          const resp = await fetch(`./${file}`)
          const data = await resp.json()
          data.forEach(item => {
            extMap[item.id] = item
          })
        }
        setExtendedData(extMap)
        setLoading(false)
      } catch (err) {
        console.error("Hiba az adatok betöltésekor:", err)
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const recommendSimilar = (item) => {
    const itemExt = extendedData[item.id]
    if (!itemExt) return
    
    setRecommendBase(item)
    // Kiválasztjuk az első 3 tagot, és beállítjuk szűrőnek
    const tagsToUse = itemExt.tags.slice(0, 3)
    setFilters(prev => ({
      ...prev,
      type: item.type,
      tag: tagsToUse[0] || '',
      search: ''
    }))
  }

  // Szűrés logika
  const filteredMedia = allMedia.filter(item => {
    const ext = extendedData[item.id] || { tags: [], pacing: 'Ismeretlen' }
    
    if (filters.type && item.type !== filters.type) return false
    if (filters.search && !item.title.toLowerCase().includes(filters.search.toLowerCase())) return false
    
    // Hivatalos genre (OpenLibrary, IGDB, AniList)
    const genres = item.genres || []
    if (filters.genre && !genres.some(g => g.toLowerCase().includes(filters.genre.toLowerCase()))) return false
    
    // Bővített tag-ek és pacing
    if (filters.tag && !ext.tags.some(t => t.toLowerCase().includes(filters.tag.toLowerCase()))) return false
    if (filters.pacing && ext.pacing !== filters.pacing) return false
    
    return true
  }).slice(0, 100) // Csak első 100-et mutatjuk a teljesítmény miatt

  if (loading) return <div className="container"><h2>Adatok betöltése folyamatban...</h2></div>

  return (
    <div className="container">
      <h1>Média Bázis</h1>
      
      {recommendBase && (
        <div style={{ background: '#3e2a00', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
          <strong>Ajánlások alapja:</strong> {recommendBase.title} 
          <button onClick={() => setRecommendBase(null)} style={{ marginLeft: '10px', cursor: 'pointer' }}>X</button>
        </div>
      )}

      <div className="filters">
        <input type="text" name="search" placeholder="Cím keresése..." value={filters.search} onChange={handleFilterChange} />
        
        <select name="type" value={filters.type} onChange={handleFilterChange}>
          <option value="">Minden típus</option>
          <option value="film">Film</option>
          <option value="jatek">Játék</option>
          <option value="konyv">Könyv</option>
          <option value="anime">Anime</option>
          <option value="manga">Manga/Manhwa</option>
        </select>

        <input type="text" name="genre" placeholder="Műfaj (pl. Sci-Fi)" value={filters.genre} onChange={handleFilterChange} />
        
        <input type="text" name="tag" placeholder="Specifikus tag (pl. Időutazás)" value={filters.tag} onChange={handleFilterChange} />
        
        <select name="pacing" value={filters.pacing} onChange={handleFilterChange}>
          <option value="">Bármilyen tempó</option>
          <option value="Gyors">Gyors</option>
          <option value="Közepes">Közepes</option>
          <option value="Lassú">Lassú</option>
        </select>
      </div>

      <div className="grid">
        {filteredMedia.map(item => {
          const ext = extendedData[item.id] || { tags: [] }
          return (
            <div className="card" key={item.id}>
              <h3>{item.title}</h3>
              <p><strong>Típus:</strong> {item.type}</p>
              <p><strong>Tempó:</strong> {ext.pacing}</p>
              <div>
                {ext.tags.slice(0, 5).map((tag, i) => (
                  <span className="tag" key={i}>{tag}</span>
                ))}
              </div>
              <button className="btn-recommend" onClick={() => recommendSimilar(item)}>
                Hasonlókat kérek!
              </button>
            </div>
          )
        })}
      </div>
      {filteredMedia.length === 0 && <p>Nincs találat a megadott szűrőkkel.</p>}
    </div>
  )
}
