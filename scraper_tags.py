import requests
import json
import os
import time
import math

TMDB_API_KEY = os.getenv('TMDB_API_KEY')
IGDB_CLIENT_ID = os.getenv('IGDB_CLIENT_ID')
IGDB_CLIENT_SECRET = os.getenv('IGDB_CLIENT_SECRET')
CONTACT_EMAIL = os.getenv('CONTACT_EMAIL', 'karolyi.kristof12@gmail.com')

PUBLIC_DIR = 'public'
HEADERS_OL = {'User-Agent': f'MediaPlatform/1.0 ({CONTACT_EMAIL})'}

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
    return saved_files

def load_bovitett():
    """Betölti a bovitett JSON fájlokat a manifest alapján."""
    manifest_path = os.path.join(PUBLIC_DIR, 'manifest.json')
    if not os.path.exists(manifest_path): return []
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    all_items = []
    for file in manifest.get('bovitett', []):
        filepath = os.path.join(PUBLIC_DIR, file)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f2:
                all_items.extend(json.load(f2))
    return all_items

def get_tmdb_keywords(tmdb_id):
    try:
        url = f"https://api.themoviedb.org/3/movie/{tmdb_id}/keywords?api_key={TMDB_API_KEY}"
        resp = requests.get(url)
        resp.raise_for_status()
        # Csak a neveket kérjük le
        return [k['name'] for k in resp.json().get('keywords', [])[:7]]
    except:
        return []

def get_igdb_and_steamspy_tags(igdb_id):
    tags = []
    try:
        # IGDB Token
        token_resp = requests.post(f"https://id.twitch.tv/oauth2/token?client_id={IGDB_CLIENT_ID}&client_secret={IGDB_CLIENT_SECRET}&grant_type=client_credentials").json()
        headers = {'Client-ID': IGDB_CLIENT_ID, 'Authorization': f"Bearer {token_resp['access_token']}"}
        
        # IGDB Keywords és Steam App ID lekérése
        body = f"fields keywords.name, external_games.uid, external_games.category; where id = {igdb_id};"
        resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=body)
        resp.raise_for_status()
        data = resp.json()
        
        if data:
            g = data[0]
            # IGDB Keywords (max 7)
            tags.extend([k['name'] for k in g.get('keywords', [])[:7]])
            
            # Steam App ID keresése
            steam_app_id = None
            for ext in g.get('external_games', []):
                if ext.get('category') == 1: # 1 = Steam
                    steam_app_id = ext.get('uid')
                    break
            
            # SteamSpy tagek lekérése
            if steam_app_id:
                ss_resp = requests.get(f"https://steamspy.com/api.php?request=appdetails&appid={steam_app_id}")
                if ss_resp.status_code == 200:
                    ss_tags = ss_resp.json().get('tags', [])
                    tags.extend(ss_tags) # SteamSpy összes tagje
    except:
        pass
    return tags

def get_openlibrary_subjects(work_id):
    try:
        url = f"https://openlibrary.org/works/{work_id}.json"
        resp = requests.get(url, headers=HEADERS_OL)
        resp.raise_for_status()
        # Subjects (max 7)
        return resp.json().get('subjects', [])[:7]
    except:
        return []

def main():
    all_items = load_bovitett()
    if not all_items:
        print("Nincsenek adatok a bovitett.json-ben!")
        return

    processed_count = 0
    max_per_run = 300

    for item in all_items:
        if processed_count >= max_per_run:
            print(f"Elértük a 300 db limitet ebben a futásban. Maradt még feldolgozandó elem.")
            break
            
        # Ha már done=true, átugorjuk
        if item.get('done'):
            continue
            
        media_id = item.get('id', '')
        item_type = item.get('type', '')
        current_tags = set(item.get('tags', []))
        
        print(f"Feldolgozás: {media_id} ({item_type}) - {item.get('title', '')}")
        
        new_tags = []
        if media_id.startswith('tmdb_'):
            tmdb_id = media_id.split('_')[1]
            new_tags = get_tmdb_keywords(tmdb_id)
            time.sleep(0.3) # TMDB rate limit
        
        elif media_id.startswith('igdb_'):
            igdb_id = media_id.split('_')[1]
            new_tags = get_igdb_and_steamspy_tags(igdb_id)
            time.sleep(0.3)
            
        elif media_id.startswith('ol_'):
            work_id = media_id.split('_', 1)[1]
            new_tags = get_openlibrary_subjects(work_id)
            time.sleep(0.3)
            
        elif media_id.startswith('anilist_'):
            # AniList-nél már a scraper letöltötte a részletes tageket, nem kell másodlagos lekérés
            pass
            
        # Új tagek hozzáadása (duplikációk kiszűrése)
        for t in new_tags:
            if t and t not in current_tags:
                current_tags.add(t)
                
        item['tags'] = list(current_tags)
        item['done'] = True # Feldolgozottként jelöljük
        processed_count += 1

    print(f"\nÖsszesen feldolgozva ebben a futásban: {processed_count} db.")

    # Mentés
    for filename in os.listdir(PUBLIC_DIR):
        if filename.startswith('bovitett') and filename.endswith('.json'):
            os.remove(os.path.join(PUBLIC_DIR, filename))

    saved_files = chunk_and_save('bovitett', all_items)
    
    # Manifest frissítése
    manifest_path = os.path.join(PUBLIC_DIR, 'manifest.json')
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    manifest['bovitett'] = saved_files
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=4)
        
    print("Tag scraper futás befejezve!")

if __name__ == "__main__":
    main()
