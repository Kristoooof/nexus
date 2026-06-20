import requests
import json
import os
import math
import time
import random
import datetime

TMDB_API_KEY = os.getenv('TMDB_API_KEY')
IGDB_CLIENT_ID = os.getenv('IGDB_CLIENT_ID')
IGDB_CLIENT_SECRET = os.getenv('IGDB_CLIENT_SECRET')
TVDB_API_KEY = os.getenv('TVDB_API_KEY')
CONTACT_EMAIL = os.getenv('CONTACT_EMAIL', 'karolyi.kristof12@gmail.com')

HEADERS_OL = {'User-Agent': f'MediaPlatform/1.0 ({CONTACT_EMAIL})'}
PUBLIC_DIR = 'public'
os.makedirs(PUBLIC_DIR, exist_ok=True)

def chunk_and_save(base_filename, data_list, max_items=50000):
    if not data_list: 
        filepath = os.path.join(PUBLIC_DIR, f"{base_filename}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump([], f)
        return [f"{base_filename}.json"]
    
    chunks = math.ceil(len(data_list) / max_items)
    saved_files = []
    for i in range(chunks):
        start = i * max_items
        end = start + max_items
        chunk_data = data_list[start:end]
        filename = f"{base_filename}.json" if i == 0 else f"{base_filename}{i+1}.json"
        filepath = os.path.join(PUBLIC_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(chunk_data, f, ensure_ascii=False, indent=4)
        saved_files.append(filename)
        print(f"Mentve: {filepath} ({len(chunk_data)} elem)")
    return saved_files

def load_existing_media():
    existing = {}
    manifest_path = os.path.join(PUBLIC_DIR, 'manifest.json')
    if not os.path.exists(manifest_path):
        return []
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        for key, files in manifest.items():
            if key == 'bovitett': continue
            for file in files:
                filepath = os.path.join(PUBLIC_DIR, file)
                if os.path.exists(filepath):
                    with open(filepath, 'r', encoding='utf-8') as f2:
                        items = json.load(f2)
                        for item in items:
                            existing[item['id']] = item
    except Exception as e:
        print(f"Hiba a régi adatok olvasásakor: {e}")
    return list(existing.values())

def get_tmdb_movies():
    print("Filmek letöltése (TMDB)...")
    if not TMDB_API_KEY: return []
    genres_resp = requests.get(f"https://api.themoviedb.org/3/genre/movie/list?api_key={TMDB_API_KEY}&language=en-US").json()
    genre_map = {g['id']: g['name'] for g in genres_resp.get('genres', [])}
    
    movies = []
    try:
        page = random.randint(1, 500)
        resp_hu = requests.get(f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&language=hu-HU&page={page}")
        resp_hu.raise_for_status()
        data_hu = resp_hu.json()
        
        resp_en = requests.get(f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&language=en-US&page={page}")
        resp_en.raise_for_status()
        data_en = resp_en.json()
        
        for m_hu, m_en in zip(data_hu.get('results', []), data_en.get('results', [])):
            movies.append({
                "id": f"tmdb_{m_hu['id']}",
                "title_hu": m_hu.get('title', ''),
                "title_en": m_en.get('title', '') or m_en.get('original_title', ''),
                "type": "film",
                "genres": [genre_map.get(gid, str(gid)) for gid in m_hu.get('genre_ids', [])],
                "description": m_hu.get('overview', '') or m_en.get('overview', ''),
                "image": f"https://image.tmdb.org/t/p/w500{m_hu.get('poster_path')}" if m_hu.get('poster_path') else "",
                "date": m_hu.get('release_date', ''),
                "score": m_hu.get('vote_average', 0)
            })
        time.sleep(0.5)
    except Exception as e:
        print(f"HIBA TMDB-nél: {e}")
    return movies

def get_igdb_games():
    print("Játékok letöltése (IGDB)...")
    if not IGDB_CLIENT_ID or not IGDB_CLIENT_SECRET: return []
    games = []
    try:
        token_resp = requests.post(f"https://id.twitch.tv/oauth2/token?client_id={IGDB_CLIENT_ID}&client_secret={IGDB_CLIENT_SECRET}&grant_type=client_credentials").json()
        headers = {'Client-ID': IGDB_CLIENT_ID, 'Authorization': f"Bearer {token_resp['access_token']}"}
        offset = random.randint(0, 500)
        body = f"fields name,genres.name,summary,rating,cover.image_id,first_release_date; sort rating desc; limit 50; offset {offset};"
        resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=body)
        resp.raise_for_status()
        
        for g in resp.json():
            date_str = ""
            if g.get('first_release_date'):
                date_str = datetime.datetime.fromtimestamp(g['first_release_date']).strftime('%Y-%m-%d')
            games.append({
                "id": f"igdb_{g.get('id')}",
                "title_en": g.get('name', ''),
                "title_hu": "",
                "type": "jatek",
                "genres": [genre['name'] for genre in g.get('genres', [])],
                "description": g.get('summary', ''),
                "image": f"https://images.igdb.com/igdb/image/upload/t_cover_big/{g['cover']['image_id']}.jpg" if g.get('cover') and g['cover'].get('image_id') else "",
                "date": date_str,
                "score": g.get('rating', 0)
            })
    except Exception as e:
        print(f"HIBA IGDB-nél: {e}")
    return games

def get_openlibrary_books():
    print("Könyvek letöltése (OpenLibrary)...")
    subjects = ['science_fiction', 'fantasy', 'mystery', 'thriller', 'romance', 'horror', 'history', 'young_adult']
    subject = random.choice(subjects)
    books = []
    try:
        resp = requests.get(f"https://openlibrary.org/subjects/{subject}.json?limit=50", headers=HEADERS_OL)
        resp.raise_for_status()
        data = resp.json()
        for b in data.get('works', []):
            books.append({
                "id": f"ol_{b.get('key', '').split('/')[-1]}",
                "title_en": b.get('title', ''),
                "title_hu": "",
                "type": "konyv",
                "genres": [subject.replace('_', ' ').title()],
                "author": b.get('authors', [{}])[0].get('name', '') if b.get('authors') else '',
                "image": f"https://covers.openlibrary.org/b/id/{b.get('cover_id')}-M.jpg" if b.get('cover_id') else "",
                "date": str(b.get('first_publish_year', '')),
                "score": 0
            })
    except Exception as e:
        print(f"HIBA OpenLibrary-nél: {e}")
    return books

def get_anilist_media(media_type="ANIME", country_code=None):
    type_name = "ANIME" if media_type == "ANIME" else "MANHWA" if country_code == "KR" else "MANGA"
    print(f"{type_name} letöltése (AniList)...")
    
    page = random.randint(1, 100)
    query = '''
    query ($page: Int, $perPage: Int, $type: MediaType, $country: CountryCode) {
      Page (page: $page, perPage: $perPage) {
        media (type: $type, countryOfOrigin: $country, sort: POPULARITY_DESC) {
          id title { romaji english } genres tags { name } coverImage { large } description startDate { year month day } averageScore
        }
      }
    }'''
    
    variables = {'page': page, 'perPage': 50, 'type': media_type}
    if country_code:
        variables['country'] = country_code

    items = []
    try:
        resp = requests.post("https://graphql.anilist.co", json={'query': query, 'variables': variables}, headers={'Content-Type': 'application/json'})
        data = resp.json()
        if 'errors' in data:
            print(f"GraphQL HIBA: {data['errors']}")
            return []
            
        for m in data.get('data', {}).get('Page', {}).get('media', []):
            start_date = m.get('startDate', {})
            year = start_date.get('year')
            month = start_date.get('month')
            day = start_date.get('day')
            
            # JAVÍTOTT dátum formázás (csak ha létezik a year)
            date_str = ""
            if year:
                date_str = f"{year}-{month or 1:02d}-{day or 1:02d}"
                
            items.append({
                "id": f"anilist_{m['id']}",
                "title_en": m.get('title', {}).get('english') or m.get('title', {}).get('romaji', ''),
                "title_hu": "", 
                "type": "anime" if media_type == "ANIME" else "manhwa" if country_code == "KR" else "manga",
                "genres": m.get('genres', []),
                "tags": [t['name'] for t in m.get('tags', [])[:10]],
                "description": m.get('description', '').replace('<br>', '') if m.get('description') else '',
                "image": m.get('coverImage', {}).get('large', ''),
                "date": date_str,
                "score": m.get('averageScore', 0)
            })
    except Exception as e:
        print(f"HIBA AniList-nél: {e}")
    return items

def generate_extended_tags(all_media):
    extended = []
    for item in all_media:
        tags = set(item.get('genres', []) + item.get('tags', []))
        pacing = "Közepes"
        if any(t in tags for t in ['Action', 'Adventure', 'Sci-Fi', 'Shounen']):
            pacing = "Gyors"
        elif any(t in tags for t in ['Slice of Life', 'Drama', 'Romance', 'Iyashikei']):
            pacing = "Lassú"
        extended.append({
            "id": item['id'],
            "tags": list(tags),
            "pacing": pacing
        })
    return extended

def main():
    existing_data = load_existing_media()
    print(f"Meglévő elemek betöltve: {len(existing_data)}")
    
    new_movies = get_tmdb_movies()
    new_games = get_igdb_games()
    new_books = get_openlibrary_books()
    new_animes = get_anilist_media("ANIME")
    new_mangas = get_anilist_media("MANGA", "JP")
    new_manhwas = get_anilist_media("MANGA", "KR")
    
    new_items = new_movies + new_games + new_books + new_animes + new_mangas + new_manhwas
    print(f"Új elemek lekérve: {len(new_items)}")

    merged_dict = {item['id']: item for item in existing_data}
    for item in new_items:
        if item and 'id' in item:
            merged_dict[item['id']] = item
            
    all_data = list(merged_dict.values())
    print(f"Összesített adatbázis mérete: {len(all_data)}")

    movies = [m for m in all_data if m.get('type') == 'film']
    games = [m for m in all_data if m.get('type') == 'jatek']
    books = [m for m in all_data if m.get('type') == 'konyv']
    animes = [m for m in all_data if m.get('type') == 'anime']
    mangas = [m for m in all_data if m.get('type') == 'manga']
    manhwas = [m for m in all_data if m.get('type') == 'manhwa']

    for filename in os.listdir(PUBLIC_DIR):
        if filename.endswith('.json'):
            os.remove(os.path.join(PUBLIC_DIR, filename))

    manifest = {
        'film-adat': chunk_and_save('film-adat', movies),
        'jatek-adat': chunk_and_save('jatek-adat', games),
        'konyv-adat': chunk_and_save('konyv-adat', books),
        'anime-adat': chunk_and_save('anime-adat', animes),
        'manga-adat': chunk_and_save('manga-adat', mangas),
        'manhwa-adat': chunk_and_save('manhwa-adat', manhwas)
    }
    
    extended = generate_extended_tags(all_data)
    manifest['bovitett'] = chunk_and_save('bovitett', extended)
    
    with open(os.path.join(PUBLIC_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=4)
    print("Adatfrissítés befejezve!")

if __name__ == "__main__":
    main()
