const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useMemo } from "react";

import MediaCard from "@/components/MediaCard";
import FilterDrawer from "@/components/FilterDrawer";
import useMediaSync from "@/hooks/useMediaSync";
import { Search, X } from "lucide-react";

export default function Discover() {
  const { syncing } = useMediaSync();
  const [allMedia, setAllMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    types: [],
    genres: [],
    pacing: [],
    tone: [],
    tags: [],
    excludeTriggers: [],
    yearFrom: "",
    yearTo: "",
    durationMin: "",
    durationMax: "",
    ratingMin: "",
    language: "",
    search: "",
  });

  useEffect(() => {
    if (!syncing) loadAll();
  }, [syncing]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const all = await db.entities.Media.filter({}, "-created_date", 500);
      setAllMedia(all);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const availableGenres = useMemo(() => {
    const set = new Set();
    allMedia.forEach((m) => (m.genres || []).forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [allMedia]);

  const availableTags = useMemo(() => {
    const set = new Set();
    allMedia.forEach((m) => (m.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [allMedia]);

  const availableTriggerWarnings = useMemo(() => {
    const set = new Set();
    allMedia.forEach((m) => (m.trigger_warnings || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [allMedia]);

  const filteredMedia = useMemo(() => {
    return allMedia.filter((m) => {
      // Type filter
      if (filters.types?.length > 0 && !filters.types.includes(m.type)) return false;

      // Genre filter (AND logic: media must have ALL selected genres)
      if (filters.genres?.length > 0) {
        const mediaGenres = m.genres || [];
        if (!filters.genres.every((g) => mediaGenres.includes(g))) return false;
      }

      // Pacing filter
      if (filters.pacing?.length > 0 && (!m.pacing || !filters.pacing.includes(m.pacing))) return false;

      // Tone filter
      if (filters.tone?.length > 0 && (!m.tone || !filters.tone.includes(m.tone))) return false;

      // Tags filter (AND logic)
      if (filters.tags?.length > 0) {
        const mediaTags = m.tags || [];
        if (!filters.tags.every((t) => mediaTags.includes(t))) return false;
      }

      // Trigger warnings exclusion
      if (filters.excludeTriggers?.length > 0) {
        const mediaTriggers = m.trigger_warnings || [];
        if (filters.excludeTriggers.some((t) => mediaTriggers.includes(t))) return false;
      }

      // Year range
      if (filters.yearFrom && m.release_year < parseInt(filters.yearFrom)) return false;
      if (filters.yearTo && m.release_year > parseInt(filters.yearTo)) return false;

      // Duration range
      if (filters.durationMin && m.duration_minutes && m.duration_minutes < parseInt(filters.durationMin)) return false;
      if (filters.durationMax && m.duration_minutes && m.duration_minutes > parseInt(filters.durationMax)) return false;

      // Rating minimum
      if (filters.ratingMin && m.avg_rating < parseInt(filters.ratingMin)) return false;

      // Language
      if (filters.language && m.languages) {
        const langLower = filters.language.toLowerCase();
        if (!m.languages.some((l) => l.toLowerCase().includes(langLower))) return false;
      }

      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [m.title, m.description, ...(m.genres || []), ...(m.tags || []), ...(m.creators || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      return true;
    });
  }, [allMedia, filters]);

  if (loading || syncing) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">
          {syncing ? "Adatok szinkronizálása..." : "Betöltés..."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Felfedezés</h1>
        <p className="text-muted-foreground text-sm">
          Böngéssz a teljes katalógusban és használd a részletes szűrőket
        </p>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Keresés cím, leírás, műfaj, alkotó alapján..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-secondary/40 border border-border/20 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => setFilters({ ...filters, search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-secondary text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <FilterDrawer
          filters={filters}
          onChange={setFilters}
          availableGenres={availableGenres}
          availableTags={availableTags}
          availableTriggerWarnings={availableTriggerWarnings}
        />
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-6">
        {filteredMedia.length} találat {allMedia.length} médiából
      </p>

      {/* Results Grid */}
      {filteredMedia.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredMedia.map((m) => (
            <MediaCard key={m.id} media={m} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-lg mb-2">Nincs találat</p>
          <p className="text-sm text-muted-foreground/60">
            Próbálj módosítani a szűrőkön vagy bővíteni a keresést
          </p>
        </div>
      )}
    </div>
  );
}