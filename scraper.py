import requests
import json
import os
import math
import time
import random
import datetime
import re

TMDB_API_KEY = os.getenv('TMDB_API_KEY')
IGDB_CLIENT_ID = os.getenv('IGDB_CLIENT_ID')
IGDB_CLIENT_SECRET = os.getenv('IGDB_CLIENT_SECRET')
TVDB_API_KEY = os.getenv('TVDB_API_KEY')
CONTACT_EMAIL = os.getenv('CONTACT_EMAIL', 'karolyi.kristof12@gmail.com')

HEADERS_OL = {'User-Agent': f'MediaPlatform/1.0 ({CONTACT_EMAIL})'}
PUBLIC_DIR = 'public'
os.makedirs(PUBLIC_DIR, exist_ok=True)

def normalize_title(title):
    if not title: return ""
    title = title.lower()
    keywords_to_remove = [
        'gold edition', 'game of the year edition', 'goty', 'deluxe edition', 
        'ultimate edition', 'remastered', "director's cut", 'complete edition', 
        'standard edition', 'premium edition', 'special edition', 'limited edition',
        ' - special', ' - deluxe', ' - premium', ' - ultimate', ' - goty', ' - remastered'
    ]
    for kw in keywords_to_remove:
        title = title.replace(kw, '')
    title = re.sub(r'\s+', ' ', title).strip()
    return title

# ÚJ: Segédfüggvény a szövegek normalizálására (kisbetű, aposztrófok eltávolítása)
def normalize_str(s):
    if not s: return ""
    return s.lower().replace("'", "").replace("’", "").strip()

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

def load_existing_bovitett():
    existing_ext = {}
    manifest_path = os.path.join(PUBLIC_DIR, 'manifest.json')
    if not os.path.exists(manifest_path):
        return {}
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        for file in manifest.get('bovitett', []):
            filepath = os.path.join(PUBLIC_DIR, file)
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f2:
                    items = json.load(f2)
                    for item in items:
                        existing_ext[item['id']] = item
    except:
        pass
    return existing_ext

def get_tmdb_movies(existing_ids, existing_norm_titles):
    print("Filmek letöltése (TMDB)...")
    if not TMDB_API_KEY: return []
    genres_resp = requests.get(f"https://api.themoviedb.org/3/genre/movie/list?api_key={TMDB_API_KEY}&language=en-US").json()
    genre_map = {g['id']: g['name'] for g in genres_resp.get('genres', [])}
    
    movies = []
    target_new = 50
    attempts = 0
    max_attempts = 5
    
    try:
        while len(movies) < target_new and attempts < max_attempts:
            attempts += 1
            page = random.randint(1, 500)
            print(f"  TMDB Próba {attempts} - Oldal: {page} (Cél: {target_new} új)")
            
            resp_hu = requests.get(f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&language=hu-HU&page={page}")
            resp_hu.raise_for_status()
            data_hu = resp_hu.json()
            
            resp_en = requests.get(f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&language=en-US&page={page}")
            resp_en.raise_for_status()
            data_en = resp_en.json()
            
            for m_hu, m_en in zip(data_hu.get('results', []), data_en.get('results', [])):
                if m_hu.get('adult', False): continue
                
                item_id = f"tmdb_{m_hu['id']}"
                norm_title = normalize_title(m_en.get('title', '') or m_en.get('original_title', ''))
                
                if item_id in existing_ids or norm_title in existing_norm_titles:
                    continue
                
                existing_ids.add(item_id)
                existing_norm_titles.add(norm_title)
                
                genres_list = [genre_map.get(gid, '') for gid in m_hu.get('genre_ids', [])]
                age_rating = "12+"
                if any(g in ['Horror', 'Thriller'] for g in genres_list):
                    age_rating = "16+"
                    
                movies.append({
                    "id": item_id,
                    "title_hu": m_hu.get('title', ''),
                    "title_en": m_en.get('title', '') or m_en.get('original_title', ''),
                    "type": "film",
                    "genres": genres_list,
                    "description": m_hu.get('overview', '') or m_en.get('overview', ''),
                    "image": f"https://image.tmdb.org/t/p/w500{m_hu.get('poster_path')}" if m_hu.get('poster_path') else "",
                    "date": m_hu.get('release_date', ''),
                    "score": m_hu.get('vote_average', 0),
                    "age_rating": age_rating,
                    "cover_nsfw": False
                })
            time.sleep(0.5)
            
    except Exception as e:
        print(f"HIBA TMDB-nél: {e}")
    print(f"  -> {len(movies)} új film találva.")
    return movies

def get_igdb_games(existing_ids, existing_norm_titles):
    print("Játékok letöltése (IGDB)...")
    if not IGDB_CLIENT_ID or not IGDB_CLIENT_SECRET: return []
    games = []
    target_new = 50
    attempts = 0
    max_attempts = 5
    
    try:
        token_resp = requests.post(f"https://id.twitch.tv/oauth2/token?client_id={IGDB_CLIENT_ID}&client_secret={IGDB_CLIENT_SECRET}&grant_type=client_credentials").json()
        headers = {'Client-ID': IGDB_CLIENT_ID, 'Authorization': f"Bearer {token_resp['access_token']}"}
        
        while len(games) < target_new and attempts < max_attempts:
            attempts += 1
            offset = random.randint(0, 5000)
            print(f"  IGDB Próba {attempts} - Offset: {offset} (Cél: {target_new} új)")
            
            body = f"fields name,genres.name,summary,rating,cover.image_id,first_release_date,age_ratings.rating; sort rating desc; limit 50; offset {offset};"
            resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=body)
            resp.raise_for_status()
            
            for g in resp.json():
                item_id = f"igdb_{g.get('id')}"
                norm_title = normalize_title(g.get('name', ''))
                
                if item_id in existing_ids or norm_title in existing_norm_titles:
                    continue
                    
                existing_ids.add(item_id)
                existing_norm_titles.add(norm_title)
                
                date_str = ""
                if g.get('first_release_date'):
                    date_str = datetime.datetime.fromtimestamp(g['first_release_date']).strftime('%Y-%m-%d')
                    
                genres_list = [genre['name'] for genre in g.get('genres', [])]
                age_rating = "16+" if any(x in genres_list for x in ['Shooter', 'Fighting']) else "12+"
                
                games.append({
                    "id": item_id,
                    "title_en": g.get('name', ''),
                    "title_hu": "",
                    "type": "jatek",
                    "genres": genres_list,
                    "description": g.get('summary', ''),
                    "image": f"https://images.igdb.com/igdb/image/upload/t_cover_big/{g['cover']['image_id']}.jpg" if g.get('cover') and g['cover'].get('image_id') else "",
                    "date": date_str,
                    "score": g.get('rating', 0),
                    "age_rating": age_rating,
                    "cover_nsfw": False
                })
            time.sleep(0.5)
            
    except Exception as e:
        print(f"HIBA IGDB-nél: {e}")
    print(f"  -> {len(games)} új játék találva.")
    return games

def get_openlibrary_books(existing_ids, existing_norm_titles):
    print("Könyvek letöltése (OpenLibrary)...")
    subjects = ['science_fiction', 'fantasy', 'mystery', 'thriller', 'romance', 'horror', 'history', 'young_adult', 'adventure', 'children']
    books = []
    target_new = 50
    attempts = 0
    max_attempts = 5
    
    try:
        while len(books) < target_new and attempts < max_attempts:
            attempts += 1
            subject = random.choice(subjects)
            print(f"  OpenLibrary Próba {attempts} - Műfaj: {subject} (Cél: {target_new} új)")
            
            resp = requests.get(f"https://openlibrary.org/subjects/{subject}.json?limit=50", headers=HEADERS_OL)
            resp.raise_for_status()
            data = resp.json()
            
            for b in data.get('works', []):
                item_id = f"ol_{b.get('key', '').split('/')[-1]}"
                norm_title = normalize_title(b.get('title', ''))
                
                if item_id in existing_ids or norm_title in existing_norm_titles:
                    continue
                    
                existing_ids.add(item_id)
                existing_norm_titles.add(norm_title)
                
                books.append({
                    "id": item_id,
                    "title_en": b.get('title', ''),
                    "title_hu": "",
                    "type": "konyv",
                    "genres": [subject.replace('_', ' ').title()],
                    "author": b.get('authors', [{}])[0].get('name', '') if b.get('authors') else '',
                    "image": f"https://covers.openlibrary.org/b/id/{b.get('cover_id')}-M.jpg" if b.get('cover_id') else "",
                    "date": str(b.get('first_publish_year', '')),
                    "score": 0,
                    "age_rating": "Unknown",
                    "cover_nsfw": False
                })
            time.sleep(0.5)
            
    except Exception as e:
        print(f"HIBA OpenLibrary-nél: {e}")
    print(f"  -> {len(books)} új könyv találva.")
    return books

def get_anilist_media(existing_ids, existing_norm_titles, media_type="ANIME", country_code=None):
    type_name = "ANIME" if media_type == "ANIME" else "MANHWA" if country_code == "KR" else "MANGA"
    print(f"{type_name} letöltése (AniList)...")
    
    items = []
    target_new = 50
    attempts = 0
    max_attempts = 5
    
    query = '''
    query ($page: Int, $perPage: Int, $type: MediaType, $country: CountryCode) {
      Page (page: $page, perPage: $perPage) {
        media (type: $type, countryOfOrigin: $country, sort: POPULARITY_DESC) {
          id title { romaji english } genres isAdult tags { name } coverImage { large } description startDate { year month day } averageScore
        }
      }
    }'''
    
    try:
        while len(items) < target_new and attempts < max_attempts:
            attempts += 1
            page = random.randint(1, 500)
            print(f"  AniList ({type_name}) Próba {attempts} - Oldal: {page} (Cél: {target_new} új)")
            
            variables = {'page': page, 'perPage': 50, 'type': media_type}
            if country_code: variables['country'] = country_code

            resp = requests.post("https://graphql.anilist.co", json={'query': query, 'variables': variables}, headers={'Content-Type': 'application/json'})
            data = resp.json()
            if 'errors' in data: continue
                
            for m in data.get('data', {}).get('Page', {}).get('media', []):
                if m.get('isAdult'): continue
                
                genres = m.get('genres', [])
                tags = [t['name'] for t in m.get('tags', [])[:10]]
                
                # JAVÍTOTT SZIGORÚ SZŰRÉS (Normalizált szövegekkel az aposztrófok miatt)
                banned_genres_norm = {normalize_str(g) for g in ['Ecchi', 'Smut', 'Erotica', 'Hentai', 'Boys Love', 'Girls Love', 'Yaoi', 'Yuri', 'BL', 'GL']}
                banned_tags_norm = {normalize_str(t) for t in ['Sexual Violence', 'Rape', 'Incest', 'Prostitution', 'LGBTQ+ Themes', 'Boys Love', 'Girls Love', 'Yaoi', 'Yuri', 'BL', 'GL']}
                
                genres_norm = [normalize_str(g) for g in genres]
                tags_norm = [normalize_str(t) for t in tags]
                
                if any(g in banned_genres_norm for g in genres_norm) or any(t in banned_tags_norm for t in tags_norm):
                    continue
                
                item_id = f"anilist_{m['id']}"
                title_en = m.get('title', {}).get('english') or m.get('title', {}).get('romaji', '')
                norm_title = normalize_title(title_en)
                
                if item_id in existing_ids or norm_title in existing_norm_titles:
                    continue
                    
                existing_ids.add(item_id)
                existing_norm_titles.add(norm_title)
                
                start_date = m.get('startDate', {})
                year = start_date.get('year')
                date_str = f"{year}-{start_date.get('month', 1):02d}-{start_date.get('day', 1):02d}" if year else ""
                
                age_rating = "12+"
                cover_nsfw = False
                if any(g in ['Horror'] for g in genres) or any(t in ['Gore', 'Bloodshed'] for t in tags):
                    age_rating = "16+"
                if any(t in ['Nudity'] for t in tags):
                    cover_nsfw = True
                    
                items.append({
                    "id": item_id,
                    "title_en": title_en,
                    "title_hu": "", 
                    "type": "anime" if media_type == "ANIME" else "manhwa" if country_code == "KR" else "manga",
                    "genres": genres,
                    "tags": tags,
                    "description": m.get('description', '').replace('<br>', '') if m.get('description') else '',
                    "image": m.get('coverImage', {}).get('large', ''),
                    "date": date_str,
                    "score": m.get('averageScore', 0),
                    "age_rating": age_rating,
                    "cover_nsfw": cover_nsfw
                })
            time.sleep(1)
            
    except Exception as e:
        print(f"HIBA AniList-nél: {e}")
    print(f"  -> {len(items)} új {type_name} találva.")
    return items

def generate_extended_tags(all_media, existing_bovitett):
    extended = []
    for item in all_media:
        item_id = item['id']
        if item_id in existing_bovitett and existing_bovitett[item_id].get('done'):
            extended.append(existing_bovitett[item_id])
            continue
            
        tags = set(item.get('genres', []) + item.get('tags', []))
        pacing = "Közepes"
        if any(t in tags for t in ['Action', 'Adventure', 'Sci-Fi', 'Shounen']):
            pacing = "Gyors"
        elif any(t in tags for t in ['Slice of Life', 'Drama', 'Romance', 'Iyashikei']):
            pacing = "Lassú"
            
        if item_id in existing_bovitett:
            tags.update(existing_bovitett[item_id].get('tags', []))
            
        extended.append({
            "id": item_id,
            "tags": list(tags),
            "pacing": pacing,
            "done": False
        })
    return extended

def main():
    existing_data = load_existing_media()
    existing_bovitett = load_existing_bovitett()
    print(f"Meglévő elemek betöltve: {len(existing_data)}")
    
    existing_ids = {item['id'] for item in existing_data}
    existing_norm_titles = set()
    for item in existing_data:
        norm = normalize_title(item.get('title_en') or item.get('title_hu'))
        if norm: existing_norm_titles.add(norm)

    new_movies = get_tmdb_movies(existing_ids, existing_norm_titles)
    new_games = get_igdb_games(existing_ids, existing_norm_titles)
    new_books = get_openlibrary_books(existing_ids, existing_norm_titles)
    new_animes = get_anilist_media(existing_ids, existing_norm_titles, "ANIME")
    new_mangas = get_anilist_media(existing_ids, existing_norm_titles, "MANGA", "JP")
    new_manhwas = get_anilist_media(existing_ids, existing_norm_titles, "MANGA", "KR")
    
    new_items = new_movies + new_games + new_books + new_animes + new_mangas + new_manhwas
    print(f"Összes új elem hozzáadva: {len(new_items)}")

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
    
    extended = generate_extended_tags(all_data, existing_bovitett)
    manifest['bovitett'] = chunk_and_save('bovitett', extended)
    
    with open(os.path.join(PUBLIC_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=4)
    print("Adatfrissítés befejezve!")

if __name__ == "__main__":
    main()
