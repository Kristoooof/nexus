import requests
import json
import os
import math
import time

TMDB_API_KEY = os.getenv('TMDB_API_KEY')
IGDB_CLIENT_ID = os.getenv('IGDB_CLIENT_ID')
IGDB_CLIENT_SECRET = os.getenv('IGDB_CLIENT_SECRET')
TVDB_API_KEY = os.getenv('TVDB_API_KEY')
CONTACT_EMAIL = os.getenv('CONTACT_EMAIL', 'karolyi.kristof12@gmail.com')

HEADERS_OL = {'User-Agent': f'MediaPlatform/1.0 ({CONTACT_EMAIL})'}
PUBLIC_DIR = 'public'
os.makedirs(PUBLIC_DIR, exist_ok=True)

def fetch_data(url, headers=None, params=None, body=None, is_graphql=False):
    try:
        if is_graphql:
            resp = requests.post(url, headers=headers, json=body)
        elif body:
            resp = requests.post(url, headers=headers, data=body)
        else:
            resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Hiba: {url} - {e}")
        return None

def chunk_and_save(base_filename, data_list, max_items=50000):
    if not data_list: return []
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

def get_tmdb_movies():
    print("Filmek letöltése (TMDB)...")
    # Műfaj ID -> Név szótár lekérése
    genres_resp = fetch_data(f"https://api.themoviedb.org/3/genre/movie/list?api_key={TMDB_API_KEY}&language=hu-HU")
    genre_map = {g['id']: g['name'] for g in genres_resp.get('genres', [])} if genres_resp else {}
    
    movies = []
    for page in range(1, 6):
        data = fetch_data(f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&language=hu-HU&page={page}")
        if data and 'results' in data:
            for m in data['results']:
                movies.append({
                    "id": f"tmdb_{m['id']}",
                    "title": m.get('title', ''),
                    "type": "film",
                    "genres": [genre_map.get(gid, str(gid)) for gid in m.get('genre_ids', [])],
                    "description": m.get('overview', ''),
                    "image": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get('poster_path') else ""
                })
        time.sleep(0.5)
    return movies

def get_igdb_games():
    print("Játékok letöltése (IGDB)...")
    token_data = fetch_data(f"https://id.twitch.tv/oauth2/token?client_id={IGDB_CLIENT_ID}&client_secret={IGDB_CLIENT_SECRET}&grant_type=client_credentials")
    if not token_data: return []
    
    headers = {'Client-ID': IGDB_CLIENT_ID, 'Authorization': f"Bearer {token_data['access_token']}"}
    # cover.image_id hozzáadva a lekéréshez
    body = "fields name,genres.name,summary,rating,cover.image_id; sort rating desc; limit 50;"
    resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=body)
    games = []
    if resp.status_code == 200:
        for g in resp.json():
            games.append({
                "id": f"igdb_{g.get('id')}",
                "title": g.get('name', ''),
                "type": "jatek",
                "genres": [genre['name'] for genre in g.get('genres', [])],
                "description": g.get('summary', ''),
                "image": f"https://images.igdb.com/igdb/image/upload/t_cover_big/{g['cover']['image_id']}.jpg" if g.get('cover') else ""
            })
    return games

def get_openlibrary_books():
    print("Könyvek letöltése (OpenLibrary)...")
    data = fetch_data("https://openlibrary.org/subjects/science_fiction.json?limit=50", headers=HEADERS_OL)
    books = []
    if data and 'works' in data:
        for b in data['works']:
            books.append({
                "id": f"ol_{b.get('key', '').split('/')[-1]}",
                "title": b.get('title', ''),
                "type": "konyv",
                "genres": ["Science Fiction"],
                "author": b.get('authors', [{}])[0].get('name', '') if b.get('authors') else '',
                "image": f"https://covers.openlibrary.org/b/id/{b.get('cover_id')}-M.jpg" if b.get('cover_id') else ""
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
          tags { name }
          coverImage { large }
          description
        }
      }
    }'''
    variables = {'page': 1, 'perPage': 50, 'type': media_type}
    data = fetch_data("https://graphql.anilist.co", body={'query': query, 'variables': variables}, is_graphql=True)
    items = []
    if data and 'data' in data:
        for m in data['data']['Page']['media']:
            items.append({
                "id": f"anilist_{m['id']}",
                "title": m['title'].get('romaji') or m['title'].get('english', ''),
                "type": "anime" if media_type == "ANIME" else "manga",
                "genres": m.get('genres', []),
                "tags": [t['name'] for t in m.get('tags', [])[:10]], # Csak top 10 tag a tisztább adatért
                "description": m.get('description', '').replace('<br>', '') if m.get('description') else '',
                "image": m.get('coverImage', {}).get('large', '')
            })
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
    # Try-except blokkok, hogy egy API hiba ne törje meg az egészet
    try: movies = get_tmdb_movies()
    except: movies = []
    try: games = get_igdb_games()
    except: games = []
    try: books = get_openlibrary_books()
    except: books = []
    try: animes = get_anilist_media("ANIME")
    except: animes = []
    try: mangas = get_anilist_media("MANGA")
    except: mangas = []
    
    all_data = movies + games + books + animes + mangas
    
    manifest = {
        'film-adat': chunk_and_save('film-adat', movies),
        'jatek-adat': chunk_and_save('jatek-adat', games),
        'konyv-adat': chunk_and_save('konyv-adat', books),
        'anime-adat': chunk_and_save('anime-adat', animes),
        'manga-adat': chunk_and_save('manga-adat', mangas)
    }
    
    extended = generate_extended_tags(all_data)
    manifest['bovitett'] = chunk_and_save('bovitett', extended)
    
    with open(os.path.join(PUBLIC_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=4)
    print("Adatfrissítés befejezve!")

if __name__ == "__main__":
    main()
