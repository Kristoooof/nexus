const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useMemo } from "react";

import MediaCard from "@/components/MediaCard";
import { Lightbulb, Search, Plus, X, Sparkles, Star, TrendingUp } from "lucide-react";

export default function Recommendations() {
  const [allMedia, setAllMedia] = useState([]);
  const [userEntries, setUserEntries] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await db.auth.me().catch(() => null);
      setCurrentUser(user);

      const [media, entries] = await Promise.all([
        db.entities.Media.filter({}, "-avg_rating", 500),
        user
          ? db.entities.UserMediaEntry.filter({ user_id: user.id }, undefined, 500)
          : Promise.resolve([]),
      ]);

      setAllMedia(media);
      setUserEntries(entries);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const alreadyListedIds = useMemo(() => {
    return new Set(userEntries.map((e) => e.media_id));
  }, [userEntries]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allMedia
      .filter(
        (m) =>
          m.title.toLowerCase().includes(q) &&
          !selectedMedia.find((s) => s.id === m.id)
      )
      .slice(0, 8);
  }, [searchQuery, allMedia, selectedMedia]);

  const addMedia = (m) => {
    if (selectedMedia.length >= 5) return;
    setSelectedMedia([...selectedMedia, m]);
    setSearchQuery("");
  };

  const removeMedia = (id) => {
    setSelectedMedia(selectedMedia.filter((m) => m.id !== id));
    setShowResults(false);
  };

  const calculateRecommendations = () => {
    if (selectedMedia.length === 0) return;

    // Build tag profile from selected media
    const tagScores = {};
    const allTags = new Set();

    selectedMedia.forEach((m) => {
      const tags = [
        ...(m.genres || []),
        ...(m.sub_genres || []),
        ...(m.tags || []),
        m.pacing,
        m.tone,
        m.type,
      ].filter(Boolean);

      tags.forEach((tag) => {
        allTags.add(tag);
        tagScores[tag] = (tagScores[tag] || 0) + 1;
      });
    });

    // Score all other media
    const excludedIds = new Set([
      ...selectedMedia.map((m) => m.id),
      ...alreadyListedIds,
    ]);

    const scored = allMedia
      .filter((m) => !excludedIds.has(m.id))
      .map((m) => {
        let score = 0;
        const mediaTags = [
          ...(m.genres || []),
          ...(m.sub_genres || []),
          ...(m.tags || []),
          m.pacing,
          m.tone,
          m.type,
        ].filter(Boolean);

        mediaTags.forEach((tag) => {
          if (tagScores[tag]) {
            score += tagScores[tag];
          }
        });

        // Boost by rating if available
        if (m.avg_rating > 0) {
          score += m.avg_rating * 0.5;
        }

        // Penalize trigger warnings (soft)
        if (m.trigger_warnings?.length > 0) {
          score -= m.trigger_warnings.length * 0.3;
        }

        return { media: m, score: Math.round(score * 10) / 10 };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    setRecommendations(scored);
    setShowResults(true);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Ajánlások</h1>
        <p className="text-muted-foreground text-sm">
          Válassz ki 1–5 médiumot amit szerettél, és mi ajánlunk hasonlókat
        </p>
      </div>

      {/* Selection Area */}
      <div className="glass-card p-6 mb-8">
        {/* Selected media */}
        {selectedMedia.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedMedia.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm"
              >
                <span className="text-foreground font-medium truncate max-w-[200px]">{m.title}</span>
                <button
                  onClick={() => removeMedia(m.id)}
                  className="p-0.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={selectedMedia.length >= 5 ? "Maximum 5 kiválasztható" : "Keress egy médiumot... (max 5)"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={selectedMedia.length >= 5}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/40 border border-border/20 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="glass border border-border/30 rounded-xl overflow-hidden mb-4">
            {searchResults.map((m) => (
              <button
                key={m.id}
                onClick={() => addMedia(m)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors border-b border-border/10 last:border-0"
              >
                {m.cover_image ? (
                  <img src={m.cover_image} alt="" className="w-8 h-12 object-cover rounded" />
                ) : (
                  <div className="w-8 h-12 bg-secondary rounded" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.release_year}{" · "}
                    {m.avg_rating > 0 && (
                      <span className="flex items-center gap-0.5 inline-flex">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {m.avg_rating.toFixed(1)}
                      </span>
                    )}
                  </p>
                </div>
                <Plus className="w-4 h-4 ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={calculateRecommendations}
          disabled={selectedMedia.length === 0}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-display font-semibold text-base hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed glow-primary"
        >
          <Sparkles className="w-5 h-5" />
          Ajánlások generálása
        </button>
      </div>

      {/* Recommendations */}
      {showResults && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="font-display text-xl font-bold text-foreground">
              {recommendations.length} ajánlás
            </h2>
          </div>

          {recommendations.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {recommendations.map(({ media: m, score }) => (
                <div key={m.id} className="relative">
                  <MediaCard media={m} />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary/80 text-white text-[10px] font-bold z-10">
                    {score}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Lightbulb className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nem találtunk hasonló médiumokat a választásaid alapján.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Próbálj más médiumokat kiválasztani vagy bővíteni a listádat.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}