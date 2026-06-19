import requests
import json
import os
import math
import time
import random

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
    """Betölti a már letöltött adatokat, hogy ne töröljük őket, hanem bővítsük."""
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
                            existing[item['id']] = item # ID alapján felülírjuk/betesszük
    except Exception as e:
        print(f"Hiba a régi adatok olvasásakor: {e}")
    return list(existing.values())

def get_tmdb_movies():
    print("Filmek letöltése (TMDB)...")
    if not TMDB_API_KEY: return []
    genres_resp = requests.get(f"https://api.themoviedb.org/3/genre/movie/list?api_key={TMDB_API_KEY}&language=hu-HU").json()
    genre_map = {g['id']: g['name'] for g in genres_resp.get('genres', [])}
    
    movies = []
    try:
        # Véletlenszerű oldal, hogy mindig új filmeket kapjunk
        page = random.randint(1, 500)
        resp = requests.get(f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&language=hu-HU&page={page}")
        resp.raise_for_status()
        data = resp.json()
        for m in data.get('results', []):
            movies.append({
                "id": f"tmdb_{m['id']}",
                "title": m.get('title', ''),
                "type": "film",
                "genres": [genre_map.get(gid, str(gid)) for gid in m.get('genre_ids', [])],
                "description": m.get('overview', ''),
                "image": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get('poster_path') else ""
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
        # Véletlenszerű offset
        offset = random.randint(0, 500)
        body = f"fields name,genres.name,summary,rating,cover.image_id; sort rating desc; limit 50; offset {offset};"
        resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=body)
        resp.raise_for_status()
        
        for g in resp.json():
            games.append({
                "id": f"igdb_{g.get('id')}",
                "title": g.get('name', ''),
                "type": "jatek",
                "genres": [genre['name'] for genre in g.get('genres', [])],
                "description": g.get('summary', ''),
                "image": f"https://images.igdb.com/igdb/image/upload/t_cover_big/{g['cover']['image_id']}.jpg" if g.get('cover') and g['cover'].get('image_id') else ""
            })
    except Exception as e:
        print(f"HIBA IGDB-nél: {e}")
    return games

def get_openlibrary_books():
    print("Könyvek letöltése (OpenLibrary)...")
    # Véletlenszerű műfaj
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
                "title": b.get('title', ''),
                "type": "konyv",
                "genres": [subject.replace('_', ' ').title()],
                "author": b.get('authors', [{}])[0].get('name', '') if b.get('authors') else '',
                "image": f"https://covers.openlibrary.org/b/id/{b.get('cover_id')}-M.jpg" if b.get('cover_id') else ""
            })
    except Exception as e:
        print(f"HIBA OpenLibrary-nél: {e}")
    return books

def get_anilist_media(media_type="ANIME", country_code=None):
    type_name = "ANIME" if media_type == "ANIME" else "MANHWA" if country_code == "KR" else "MANGA"
    print(f"{type_name} letöltése (AniList)...")
    
    page = random.randint(1, 100) # Véletlenszerű oldal
    
    # Két külön query, hogy a GraphQL ne kapjon null-t az animéknél
    if country_code:
        query = '''
        query ($page: Int, $perPage: Int, $type: MediaType, $country: CountryCode) {
          Page (page: $page, perPage: $perPage) {
            media (type: $type, countryOfOrigin: $country, sort: POPULARITY_DESC) {
              id title { romaji english } genres tags { name } coverImage { large } description
            }
          }
        }'''
        variables = {'page': page, 'perPage': 50, 'type': media_type, 'country': country_code}
    else:
        query = '''
        query ($page: Int, $perPage: Int, $type: MediaType) {
          Page (page: $page, perPage: $perPage) {
            media (type: $type, sort: POPULARITY_DESC) {
              id title { romaji english } genres tags { name } coverImage { large } description
            }
          }
        }'''
        variables = {'page': page, 'perPage': 50, 'type': media_type}

    items = []
    try:
        resp = requests.post("https://graphql.anilist.co", json={'query': query, 'variables': variables}, headers={'Content-Type': 'application/json'})
        data = resp.json()
        
        if 'errors' in data:
            print(f"GraphQL HIBA: {data['errors']}")
            return []
            
        for m in data.get('data', {}).get('Page', {}).get('media', []):
            title = m.get('title', {}).get('english') or m.get('title', {}).get('romaji', '')
            items.append({
                "id": f"anilist_{m['id']}",
                "title": title,
                "type": "anime" if media_type == "ANIME" else "manhwa" if country_code == "KR" else "manga",
                "genres": m.get('genres', []),
                "tags": [t['name'] for t in m.get('tags', [])[:10]],
                "description": m.get('description', '').replace('<br>', '') if m.get('description') else '',
                "image": m.get('coverImage', {}).get('large', '')
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
            "title": item['title'],
            "type": item['type'],
            "tags": list(tags),
            "pacing": pacing
        })
    return extended

def main():
    # 1. Betöltjük a meglévő adatokat
    existing_data = load_existing_media()
    print(f"Meglévő elemek betöltve: {len(existing_data)}")
    
    # 2. Letöltjük az új adatokat
    new_movies = get_tmdb_movies()
    new_games = get_igdb_games()
    new_books = get_openlibrary_books()
    new_animes = get_anilist_media("ANIME")
    new_mangas = get_anilist_media("MANGA", "JP")
    new_manhwas = get_anilist_media("MANGA", "KR")
    
    new_items = new_movies + new_games + new_books + new_animes + new_mangas + new_manhwas
    print(f"Új elemek lekérve: {len(new_items)}")

    # 3. Összefűzzük (régi + új), duplikációkat az ID alapján eldobjuk
    merged_dict = {item['id']: item for item in existing_data}
    for item in new_items:
        if item and 'id' in item:
            merged_dict[item['id']] = item
            
    all_data = list(merged_dict.values())
    print(f"Összesített adatbázis mérete: {len(all_data)}")

    # 4. Típusok szerinti szétválogatás mentéshez
    movies = [m for m in all_data if m.get('type') == 'film']
    games = [m for m in all_data if m.get('type') == 'jatek']
    books = [m for m in all_data if m.get('type') == 'konyv']
    animes = [m for m in all_data if m.get('type') == 'anime']
    mangas = [m for m in all_data if m.get('type') == 'manga']
    manhwas = [m for m in all_data if m.get('type') == 'manhwa']

    # 5. JSON fájlok tisztítása és újraírása
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
