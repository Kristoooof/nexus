import requests
import json
import os
import math

# Környezeti változók (GitHub Secrets)
TMDB_API_KEY = os.getenv('TMDB_API_KEY')
IGDB_CLIENT_ID = os.getenv('IGDB_CLIENT_ID')
IGDB_CLIENT_SECRET = os.getenv('IGDB_CLIENT_SECRET')
TVDB_API_KEY = os.getenv('TVDB_API_KEY')
CONTACT_EMAIL = os.getenv('CONTACT_EMAIL', 'karolyi.kristof12@gmail.com')

HEADERS_OL = {'User-Agent': f'MediaPlatform/1.0 ({CONTACT_EMAIL})'}

# Helpers
def fetch_json(url, headers=None, params=None, body=None):
    try:
        if body:
            resp = requests.post(url, headers=headers, json=body)
        else:
            resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Hiba: {url} - {e}")
        return None

def chunk_and_save(base_filename, data_list, max_items=50000):
    """Feldarabolja az adatokat és elmenti multiple json fájlként."""
    if not data_list:
        return []
    
    chunks = math.ceil(len(data_list) / max_items)
    saved_files = []
    
    for i in range(chunks):
        start = i * max_items
        end = start + max_items
        chunk_data = data_list[start:end]
        
        filename = f"{base_filename}.json" if i == 0 else f"{base_filename}{i+1}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(chunk_data, f, ensure_ascii=False, indent=4)
        saved_files.append(filename)
        print(f"Mentve: {filename} ({len(chunk_data)} elem)")
    
    return saved_files

# --- API Fetchers ---

def get_tmdb_movies():
    print("Filmek letöltése (TMDB)...")
    movies = []
    for page in range(1, 6): # Top 100 film
        data = fetch_json(f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&language=hu-HU&page={page}")
        if data and 'results' in data:
            for m in data['results']:
                movies.append({
                    "id": f"tmdb_{m['id']}",
                    "title": m.get('title', ''),
                    "type": "film",
                    "genres": m.get('genre_ids', []), # TMDB ID-kat ad, a frontendnek vagy nekünk kellene map-elni
                    "description": m.get('overview', ''),
                    "release_date": m.get('release_date', '')
                })
    return movies

def get_igdb_games():
    print("Játékok letöltése (IGDB)...")
    token_url = f"https://id.twitch.tv/oauth2/token?client_id={IGDB_CLIENT_ID}&client_secret={IGDB_CLIENT_SECRET}&grant_type=client_credentials"
    token_data = fetch_json(token_url)
    if not token_data or 'access_token' not in token_data:
        return []
    
    headers = {'Client-ID': IGDB_CLIENT_ID, 'Authorization': f"Bearer {token_data['access_token']}"}
    body = "fields name,genres.name,summary,rating; sort rating desc; limit 50;"
    resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=body)
    games = []
    if resp.status_code == 200:
        for g in resp.json():
            games.append({
                "id": f"igdb_{g.get('id')}",
                "title": g.get('name', ''),
                "type": "jatek",
                "genres": [genre['name'] for genre in g.get('genres', [])],
                "description": g.get('summary', '')
            })
    return games

def get_openlibrary_books():
    print("Könyvek letöltése (OpenLibrary)...")
    data = fetch_json("https://openlibrary.org/subjects/science_fiction.json?limit=50", headers=HEADERS_OL)
    books = []
    if data and 'works' in data:
        for b in data['works']:
            books.append({
                "id": f"ol_{b.get('key', '').split('/')[-1]}",
                "title": b.get('title', ''),
                "type": "konyv",
                "genres": ["Science Fiction"],
                "author": b.get('authors', [{}])[0].get('name', '') if b.get('authors') else ''
            })
    return books

def get_anilist_media(media_type="ANIME"):
    print(f"{media_type} letöltése (AniList)...")
    query = '''
    query ($page: Int, $perPage: Int, $type: MediaType) {
      Page (page: $page, perPage: $perPage, type: $type) {
        media (sort: POPULARITY_DESC) {
          id
          title { romaji english }
          genres
          tags { name rank }
          averageScore
          description
        }
      }
    }
    '''
    variables = {'page': 1, 'perPage': 50, 'type': media_type}
    data = fetch_json("https://graphql.anilist.co", body={'query': query, 'variables': variables})
    items = []
    if data and 'data' in data:
        for m in data['data']['Page']['media']:
            items.append({
                "id": f"anilist_{m['id']}",
                "title": m['title'].get('romaji') or m['title'].get('english', ''),
                "type": "anime" if media_type == "ANIME" else "manga",
                "genres": m.get('genres', []),
                "tags": [t['name'] for t in m.get('tags', [])], # Ez brutálisan sok specifikus taget ad!
                "description": m.get('description', '').replace('<br>', '')
            })
    return items

# --- Extended Tags Generator ---
def generate_extended_tags(all_media):
    """Összefűzi a hivatalos és nem hivatalos tageket, kitalál pacinget."""
    extended = []
    for item in all_media:
        tags = set(item.get('genres', []) + item.get('tags', []))
        
        # Pacing heuristic (nagyon egyszerű AI/logika helyett)
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

# --- Main ---
def main():
    movies = get_tmdb_movies()
    games = get_igdb_games()
    books = get_openlibrary_books()
    animes = get_anilist_media("ANIME")
    mangas = get_anilist_media("MANGA")
    
    all_data = movies + games + books + animes + mangas
    
    # Darabolás és mentés
    manifest = {}
    manifest['film-adat'] = chunk_and_save('film-adat', movies)
    manifest['jatek-adat'] = chunk_and_save('jatek-adat', games)
    manifest['konyv-adat'] = chunk_and_save('konyv-adat', books)
    manifest['anime-adat'] = chunk_and_save('anime-adat', animes)
    manifest['manga-adat'] = chunk_and_save('manga-adat', mangas)
    
    # Bővített adatok (tag-ek, pacing)
    extended = generate_extended_tags(all_data)
    manifest['bovitett'] = chunk_and_save('bovitett', extended)
    
    # Manifest a frontendnek, hogy tudja milyen fájlokat töltsön be
    with open('manifest.json', 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=4)
    
    print("Adatfrissítés befejezve!")

if __name__ == "__main__":
    main()
