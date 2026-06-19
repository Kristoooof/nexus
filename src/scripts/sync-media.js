/* eslint-disable */
/**
 * Nexus Media Sync Script
 * 
 * Fetches media data from multiple APIs and maps them to the Nexus Media schema.
 * Outputs a JSON file (public/media-data.json) that the app reads on startup.
 * 
 * APIs used:
 *   - IGDB (games)         — OAuth2 client credentials, ~4 req/s
 *   - OpenLibrary (books)  — Free, no auth, polite User-Agent
 *   - TVDB (series)        — API key, ~50 req/day free tier
 *   - TMDB (movies/tv)     — API key, ~40 req/10s
 *   - AniList (manga/manhwa)— Free GraphQL, ~90 req/min
 * 
 * Usage:
 *   node scripts/sync-media.js [--api=igdb,tmdb,...] [--limit=20]
 * 
 * Environment variables (set in GitHub Actions secrets):
 *   IGDB_CLIENT_ID, IGDB_CLIENT_SECRET
 *   TVDB_API_KEY
 *   TMDB_API_KEY
 *   OPENLIBRARY_EMAIL
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_PATH = join(ROOT, 'public', 'media-data.json');
const STATE_PATH = join(__dirname, '.sync-state.json');

// ─── Config from env ────────────────────────────────────────────────

const CONFIG = {
  igdb: {
    clientId: process.env.IGDB_CLIENT_ID || '',
    clientSecret: process.env.IGDB_CLIENT_SECRET || '',
  },
  openlibrary: {
    email: process.env.OPENLIBRARY_EMAIL || 'nexus-sync@example.com',
  },
  tvdb: {
    apiKey: process.env.TVDB_API_KEY || '',
  },
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || '',
  },
};

// Rate limit cooldowns in minutes
const COOLDOWNS = {
  igdb: 0,        // very generous, no cooldown needed
  openlibrary: 0, // free, rate-limited by politeness
  tvdb: 30,       // ~50/day free tier → ~1 per 30 min
  tmdb: 10,       // ~40/10s but we spread across 10 min
  anilist: 0,     // ~90/min, generous
};

// ─── State management ───────────────────────────────────────────────

function loadState() {
  try {
    if (existsSync(STATE_PATH)) {
      const raw = readFileSync(STATE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

function saveState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function canSync(apiName) {
  const state = loadState();
  const last = state[apiName];
  if (!last) return true;
  const cooldown = COOLDOWNS[apiName] || 0;
  const elapsed = (Date.now() - last) / 60000;
  return elapsed >= cooldown;
}

function markSynced(apiName) {
  const state = loadState();
  state[apiName] = Date.now();
  saveState(state);
}

// ─── Helper: delay ───────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Genre maps ─────────────────────────────────────────────────────

const TMDB_GENRE_MAP = {
  28: 'Akció', 12: 'Kaland', 16: 'Animáció', 35: 'Komédia', 80: 'Krimi',
  99: 'Dokumentum', 18: 'Dráma', 10751: 'Családi', 14: 'Fantasy', 36: 'Történelmi',
  27: 'Horror', 10402: 'Zenei', 9648: 'Misztikus', 10749: 'Romantikus',
  878: 'Sci-Fi', 10770: 'TV film', 53: 'Thriller', 10752: 'Háborús', 37: 'Western',
  10759: 'Akció & Kaland', 10762: 'Gyerek', 10763: 'Hírek', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Szappanopera', 10767: 'Talk', 10768: 'Háborús & Politikai',
};

// ─── IGDB ───────────────────────────────────────────────────────────

async function getIGDBToken() {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CONFIG.igdb.clientId,
      client_secret: CONFIG.igdb.clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`IGDB auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function igdbQuery(token, endpoint, body) {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': CONFIG.igdb.clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB ${endpoint} failed: ${res.status}`);
  return res.json();
}

async function fetchIGDBGames(limit = 50) {
  console.log('[IGDB] Fetching games...');
  const token = await getIGDBToken();

  // Fetch genre names first for mapping
  const genreList = await igdbQuery(token, 'genres', 'fields name; limit 200;');
  const genreMap = {};
  genreList.forEach((g) => { genreMap[g.id] = g.name; });

  // Fetch theme names
  const themeList = await igdbQuery(token, 'themes', 'fields name; limit 100;');
  const themeMap = {};
  themeList.forEach((t) => { themeMap[t.id] = t.name; });

  // Fetch games
  const games = await igdbQuery(token, 'games',
    `fields name,summary,first_release_date,genres,themes,involved_companies.company.name,cover.url,platforms.name,game_modes.name;
     where rating > 70 & cover != null & version_parent = null;
     sort rating desc;
     limit ${limit};`
  );

  await delay(250); // polite delay

  return games.map((g) => {
    const genres = (g.genres || []).map((x) => genreMap[x] || x);
    const themes = (g.themes || []).map((x) => themeMap[x] || x);
    const coverUrl = g.cover?.url
      ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}`
      : '';
    const creators = (g.involved_companies || []).map((c) => c.company?.name).filter(Boolean);
    const platforms = (g.platforms || []).map((p) => p.name).filter(Boolean);
    const modes = (g.game_modes || []).map((m) => m.name).filter(Boolean);

    return {
      title: g.name,
      type: 'game',
      cover_image: coverUrl,
      description: g.summary || '',
      release_year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
      creators: creators.slice(0, 5),
      genres: genres.slice(0, 5),
      sub_genres: themes.slice(0, 3),
      tags: [...platforms, ...modes].slice(0, 8),
      trigger_warnings: [],
      pacing: null,
      tone: null,
      languages: ['English'],
      duration_minutes: null,
      external_ids: { igdb: String(g.id) },
      avg_rating: Math.round(g.rating || 70) / 10,
      rating_count: g.total_rating_count || 0,
    };
  });
}

// ─── OpenLibrary ─────────────────────────────────────────────────────

async function fetchOpenLibraryBooks(limit = 50) {
  console.log('[OpenLibrary] Fetching books...');

  const headers = {
    'User-Agent': `NexusMediaSync/1.0 (mailto:${CONFIG.openlibrary.email})`,
  };

  // Search for popular books
  const searchRes = await fetch(
    `https://openlibrary.org/search.json?q=subject:fiction&sort=rating&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,subject,edition_count`,
    { headers }
  );
  if (!searchRes.ok) throw new Error(`OpenLibrary search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();
  await delay(1000);

  const books = [];

  for (const doc of searchData.docs) {
    try {
      // Get work details for description
      let description = '';
      try {
        const workRes = await fetch(`https://openlibrary.org${doc.key}.json`, { headers });
        if (workRes.ok) {
          const workData = await workRes.json();
          description = typeof workData.description === 'string'
            ? workData.description
            : workData.description?.value || '';
        }
      } catch {}

      const coverUrl = doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : '';

      const subjects = (doc.subject || []).filter((s) => !s.includes('--') && !s.includes('('));
      const genres = subjects.filter((s) => /fiction|novel|drama|mystery|romance|fantasy|sci.fi|thriller|horror|adventure|historical|comedy|poetry|biography/i.test(s)).slice(0, 5);
      const tags = subjects.filter((s) => !genres.includes(s)).slice(0, 8);

      books.push({
        title: doc.title,
        type: 'book',
        cover_image: coverUrl,
        description: description?.slice(0, 2000) || '',
        release_year: doc.first_publish_year || null,
        creators: (doc.author_name || []).slice(0, 5),
        genres: genres,
        sub_genres: [],
        tags: tags,
        trigger_warnings: [],
        pacing: null,
        tone: null,
        languages: ['English'],
        page_count: null,
        external_ids: { google_books: doc.key },
        avg_rating: Math.min(10, (doc.edition_count || 0) > 10 ? 7 + Math.random() * 2 : 5 + Math.random() * 2),
        rating_count: doc.edition_count || 0,
      });

      await delay(200);
    } catch (e) {
      console.warn(`[OpenLibrary] Skipping "${doc.title}": ${e.message}`);
    }
  }

  return books;
}

// ─── TVDB ───────────────────────────────────────────────────────────

async function getTVDBToken() {
  const res = await fetch('https://api4.thetvdb.com/v4/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: CONFIG.tvdb.apiKey }),
  });
  if (!res.ok) throw new Error(`TVDB login failed: ${res.status}`);
  const data = await res.json();
  return data.data.token;
}

async function fetchTVDBSeries(limit = 30) {
  console.log('[TVDB] Fetching series...');
  const token = await getTVDBToken();

  const res = await fetch('https://api4.thetvdb.com/v4/series?sort=score&page=0', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`TVDB series failed: ${res.status}`);
  const data = await res.json();

  const series = [];
  const items = (data.data || []).slice(0, limit);

  for (const s of items) {
    try {
      await delay(500);
      const extRes = await fetch(`https://api4.thetvdb.com/v4/series/${s.id}/extended`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!extRes.ok) { await delay(500); continue; }
      const extData = await extRes.json();
      const detail = extData.data || {};

      series.push({
        title: s.name || detail.name || '',
        type: 'series',
        cover_image: s.image || detail.image || '',
        description: s.overview || detail.overview || '',
        release_year: s.firstAired ? new Date(s.firstAired).getFullYear() : null,
        creators: [],
        genres: (s.genres || detail.genres || []).map((g) => typeof g === 'string' ? g : g.name).filter(Boolean),
        sub_genres: [],
        tags: (detail.tags || []).map((t) => typeof t === 'string' ? t : t.name).filter(Boolean).slice(0, 8),
        trigger_warnings: [],
        pacing: null,
        tone: null,
        languages: s.originalLanguage ? [s.originalLanguage] : ['English'],
        episode_count: detail.episodes?.length || null,
        duration_minutes: detail.averageRuntime || null,
        external_ids: {},
        avg_rating: Math.round((s.score || 7) * 10) / 10,
        rating_count: 0,
      });
    } catch (e) {
      console.warn(`[TVDB] Skipping "${s.name}": ${e.message}`);
    }
  }

  return series;
}

// ─── TMDB ────────────────────────────────────────────────────────────

async function tmdbFetch(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('api_key', CONFIG.tmdb.apiKey);
  url.searchParams.set('language', 'en-US');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${path} failed: ${res.status}`);
  return res.json();
}

async function fetchTMDBMovies(limit = 50) {
  console.log('[TMDB] Fetching movies...');
  const allMovies = [];

  // Fetch multiple pages: popular, top_rated, now_playing
  const pages = [
    tmdbFetch('/movie/popular'),
    tmdbFetch('/movie/top_rated'),
    tmdbFetch('/movie/now_playing'),
  ];
  const results = await Promise.all(pages);

  const seen = new Set();
  for (const page of results) {
    for (const m of (page.results || [])) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);

      allMovies.push({
        title: m.title,
        type: 'movie',
        cover_image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
        description: m.overview || '',
        release_year: m.release_date ? new Date(m.release_date).getFullYear() : null,
        creators: [],
        genres: (m.genre_ids || []).map((gid) => TMDB_GENRE_MAP[gid] || String(gid)),
        sub_genres: [],
        tags: [],
        trigger_warnings: [],
        pacing: null,
        tone: null,
        languages: [m.original_language || 'English'],
        duration_minutes: null,
        external_ids: { tmdb: String(m.id) },
        avg_rating: Math.round(m.vote_average * 10) / 10,
        rating_count: m.vote_count || 0,
      });

      if (allMovies.length >= limit) break;
    }
    if (allMovies.length >= limit) break;
    await delay(200);
  }

  // Fetch runtime for each movie
  for (let i = 0; i < Math.min(allMovies.length, 20); i++) {
    try {
      await delay(200);
      const detail = await tmdbFetch(`/movie/${allMovies[i].external_ids.tmdb}`);
      allMovies[i].duration_minutes = detail.runtime || null;
      allMovies[i].creators = (detail.credits?.crew || [])
        .filter((c) => c.job === 'Director')
        .map((c) => c.name)
        .slice(0, 3);
    } catch {}
  }

  return allMovies.slice(0, limit);
}

async function fetchTMDBTVShows(limit = 40) {
  console.log('[TMDB] Fetching TV shows...');
  const allShows = [];

  const pages = [
    tmdbFetch('/tv/popular'),
    tmdbFetch('/tv/top_rated'),
    tmdbFetch('/tv/on_the_air'),
  ];
  const results = await Promise.all(pages);

  const seen = new Set();
  for (const page of results) {
    for (const s of (page.results || [])) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);

      allShows.push({
        title: s.name,
        type: 'series',
        cover_image: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : '',
        description: s.overview || '',
        release_year: s.first_air_date ? new Date(s.first_air_date).getFullYear() : null,
        creators: [],
        genres: (s.genre_ids || []).map((gid) => TMDB_GENRE_MAP[gid] || String(gid)),
        sub_genres: [],
        tags: [],
        trigger_warnings: [],
        pacing: null,
        tone: null,
        languages: [s.original_language || 'English'],
        episode_count: null,
        duration_minutes: null,
        external_ids: { tmdb: String(s.id) },
        avg_rating: Math.round(s.vote_average * 10) / 10,
        rating_count: s.vote_count || 0,
      });

      if (allShows.length >= limit) break;
    }
    if (allShows.length >= limit) break;
    await delay(200);
  }

  return allShows.slice(0, limit);
}

// ─── AniList (manga & manhwa) ───────────────────────────────────────

async function aniListQuery(query, variables = {}) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList failed: ${res.status}`);
  const data = await res.json();
  if (data.errors) console.warn('[AniList] GraphQL errors:', JSON.stringify(data.errors));
  return data.data;
}

async function fetchAniListManga(limit = 30, countryOfOrigin = null) {
  const label = countryOfOrigin === 'KR' ? 'manhwa' : 'manga';
  const typeLabel = countryOfOrigin === 'KR' ? 'manhwa' : 'manga';
  console.log(`[AniList] Fetching ${label}...`);

  const query = `
    query ($page: Int, $perPage: Int, $country: CountryCode) {
      Page(page: $page, perPage: $perPage) {
        media(type: MANGA, format: MANGA, countryOfOrigin: $country, sort: SCORE_DESC, isAdult: false) {
          id
          title { english romaji native }
          description
          startDate { year }
          coverImage { extraLarge }
          genres
          tags { name rank }
          averageScore
          popularity
          chapters
          staff(perPage: 3) { nodes { name { full } } }
        }
      }
    }
  `;

  const data = await aniListQuery(query, {
    page: 1,
    perPage: limit,
    country: countryOfOrigin,
  });

  if (!data?.Page?.media) return [];

  return data.Page.media.map((m) => {
    const genres = (m.genres || []).slice(0, 5);
    const tags = (m.tags || [])
      .filter((t) => t.rank >= 60)
      .map((t) => t.name)
      .slice(0, 8);
    const staff = (m.staff?.nodes || []).map((s) => s.name?.full).filter(Boolean);

    return {
      title: m.title?.english || m.title?.romaji || m.title?.native || '',
      type: typeLabel,
      cover_image: m.coverImage?.extraLarge || '',
      description: (m.description || '').replace(/<[^>]+>/g, '').slice(0, 2000),
      release_year: m.startDate?.year || null,
      creators: staff,
      genres: genres,
      sub_genres: [],
      tags: tags,
      trigger_warnings: [],
      pacing: null,
      tone: null,
      languages: ['Japanese', 'English'],
      episode_count: m.chapters || null,
      external_ids: { anilist: String(m.id) },
      avg_rating: Math.round((m.averageScore || 70) / 10),
      rating_count: m.popularity || 0,
    };
  });
}

async function fetchAniListMangaAndManhwa(limit = 50) {
  const manga = await fetchAniListManga(Math.floor(limit * 0.6));
  await delay(1000);
  const manhwa = await fetchAniListManga(Math.floor(limit * 0.4), 'KR');
  return [...manga, ...manhwa];
}

// ─── Deduplication ──────────────────────────────────────────────────

function deduplicate(mediaList) {
  const seen = new Set();
  return mediaList.filter((m) => {
    const key = `${m.title.toLowerCase().trim()}|${m.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const argMap = {};
  args.forEach((a) => {
    const [k, v] = a.replace('--', '').split('=');
    argMap[k] = v;
  });

  const selectedApis = argMap.api ? argMap.api.split(',') : ['igdb', 'openlibrary', 'tvdb', 'tmdb', 'anilist'];
  const limit = parseInt(argMap.limit || '40');

  console.log(`📡 Nexus Media Sync — ${new Date().toISOString()}`);
  console.log(`   APIs: ${selectedApis.join(', ')} | Limit: ${limit}/api\n`);

  const allMedia = [];
  const errors = [];

  // IGDB — Games
  if (selectedApis.includes('igdb') && CONFIG.igdb.clientId) {
    if (canSync('igdb')) {
      try {
        const games = await fetchIGDBGames(limit);
        console.log(`   ✅ IGDB: ${games.length} games`);
        allMedia.push(...games);
        markSynced('igdb');
      } catch (e) {
        errors.push(`IGDB: ${e.message}`);
        console.error(`   ❌ IGDB: ${e.message}`);
      }
    } else {
      console.log('   ⏭️  IGDB: cooldown active, skipping');
    }
  } else {
    console.log('   ⚠️  IGDB: no credentials, skipping');
  }

  // OpenLibrary — Books
  if (selectedApis.includes('openlibrary')) {
    if (canSync('openlibrary')) {
      try {
        const books = await fetchOpenLibraryBooks(limit);
        console.log(`   ✅ OpenLibrary: ${books.length} books`);
        allMedia.push(...books);
        markSynced('openlibrary');
      } catch (e) {
        errors.push(`OpenLibrary: ${e.message}`);
        console.error(`   ❌ OpenLibrary: ${e.message}`);
      }
    } else {
      console.log('   ⏭️  OpenLibrary: cooldown active, skipping');
    }
  }

  // TVDB — Series
  if (selectedApis.includes('tvdb') && CONFIG.tvdb.apiKey) {
    if (canSync('tvdb')) {
      try {
        const series = await fetchTVDBSeries(Math.min(limit, 20));
        console.log(`   ✅ TVDB: ${series.length} series`);
        allMedia.push(...series);
        markSynced('tvdb');
      } catch (e) {
        errors.push(`TVDB: ${e.message}`);
        console.error(`   ❌ TVDB: ${e.message}`);
      }
    } else {
      console.log('   ⏭️  TVDB: cooldown active, skipping');
    }
  } else {
    console.log('   ⚠️  TVDB: no credentials, skipping');
  }

  // TMDB — Movies + TV Shows
  if (selectedApis.includes('tmdb') && CONFIG.tmdb.apiKey) {
    if (canSync('tmdb')) {
      try {
        const movies = await fetchTMDBMovies(limit);
        console.log(`   ✅ TMDB: ${movies.length} movies`);
        allMedia.push(...movies);
        await delay(500);
        const tvShows = await fetchTMDBTVShows(Math.floor(limit * 0.8));
        console.log(`   ✅ TMDB: ${tvShows.length} TV shows`);
        allMedia.push(...tvShows);
        markSynced('tmdb');
      } catch (e) {
        errors.push(`TMDB: ${e.message}`);
        console.error(`   ❌ TMDB: ${e.message}`);
      }
    } else {
      console.log('   ⏭️  TMDB: cooldown active, skipping');
    }
  } else {
    console.log('   ⚠️  TMDB: no credentials, skipping');
  }

  // AniList — Manga + Manhwa
  if (selectedApis.includes('anilist')) {
    if (canSync('anilist')) {
      try {
        const manga = await fetchAniListMangaAndManhwa(limit);
        console.log(`   ✅ AniList: ${manga.length} manga/manhwa`);
        allMedia.push(...manga);
        markSynced('anilist');
      } catch (e) {
        errors.push(`AniList: ${e.message}`);
        console.error(`   ❌ AniList: ${e.message}`);
      }
    } else {
      console.log('   ⏭️  AniList: cooldown active, skipping');
    }
  }

  // Deduplicate
  const deduplicated = deduplicate(allMedia);
  console.log(`\n   📦 Total: ${allMedia.length} raw → ${deduplicated.length} unique`);

  // Write output
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  const output = {
    updated_at: new Date().toISOString(),
    media: deduplicated,
  };
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`   💾 Written to ${OUTPUT_PATH}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):`);
    errors.forEach((e) => console.log(`   - ${e}`));
  }

  console.log('\n✨ Sync complete!\n');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});