const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import MediaCard from "@/components/MediaCard";
import { User, Star, BarChart3, CheckCircle, Clock, XCircle, TrendingUp } from "lucide-react";

const statuses = [
  { key: "watched", icon: CheckCircle, label: "Megnéztem / Olvastam" },
  { key: "planned", icon: Clock, label: "Tervezem" },
  { key: "dropped", icon: XCircle, label: "Abbahagytam" },
];

export default function Profile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [media, setMedia] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("watched");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await db.auth.me();
      setCurrentUser(user);

      const allEntries = await db.entities.UserMediaEntry.filter(
        { user_id: user.id },
        "-created_date",
        500
      );
      setEntries(allEntries);

      // Load media details
      const mediaIds = [...new Set(allEntries.map((e) => e.media_id))];
      const mediaMap = {};
      await Promise.all(
        mediaIds.map(async (mid) => {
          const result = await db.entities.Media.filter({ id: mid }, undefined, 1);
          if (result.length > 0) {
            mediaMap[mid] = result[0];
          }
        })
      );
      setMedia(mediaMap);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const filteredEntries = entries.filter((e) => e.status === activeTab);
  const ratedEntries = entries.filter((e) => e.rating > 0);

  // Stats
  const genreCounts = {};
  filteredEntries.forEach((e) => {
    const m = media[e.media_id];
    if (m?.genres) {
      m.genres.forEach((g) => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    }
  });
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const avgRating =
    ratedEntries.length > 0
      ? (ratedEntries.reduce((s, e) => s + e.rating, 0) / ratedEntries.length).toFixed(1)
      : "—";

  const totalDuration = filteredEntries.reduce((sum, e) => {
    const m = media[e.media_id];
    return sum + (m?.duration_minutes || 0);
  }, 0);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Profile Header */}
      <div className="glass-card p-6 sm:p-8 mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {currentUser?.full_name || currentUser?.email?.split("@")[0] || "Profil"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {entries.length} média a listádon
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statuses.map((s) => {
            const count = entries.filter((e) => e.status === s.key).length;
            return (
              <div key={s.key} className="glass border border-border/20 rounded-xl p-3 text-center">
                <p className="font-display text-xl font-bold text-foreground">{count}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="glass border border-border/20 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-display text-xl font-bold text-foreground">{avgRating}</span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Átlag értékelés</p>
          </div>
          <div className="glass border border-border/20 rounded-xl p-3 text-center">
            <p className="font-display text-xl font-bold text-foreground">
              {Math.round(totalDuration / 60)} óra
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Teljes hossz</p>
          </div>
          <div className="glass border border-border/20 rounded-xl p-3 text-center">
            <p className="font-display text-xl font-bold text-foreground">{ratedEntries.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Értékelve</p>
          </div>
          <div className="glass border border-border/20 rounded-xl p-3 text-center">
            <p className="font-display text-xl font-bold text-foreground">
              {Object.keys(media).length}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ismert média</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {statuses.map((s) => {
          const Icon = s.icon;
          const isActive = activeTab === s.key;
          const count = entries.filter((e) => e.status === s.key).length;
          return (
            <button
              key={s.key}
              onClick={() => setActiveTab(s.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-secondary/30 text-muted-foreground border border-border/10 hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
              <span className="text-xs opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Genre Stats */}
      {topGenres.length > 0 && activeTab === "watched" && (
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm text-foreground">Kedvenc műfajaid</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {topGenres.map(([genre, count]) => (
              <div
                key={genre}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/40 border border-border/10"
              >
                <span className="text-sm font-medium text-foreground">{genre}</span>
                <span className="text-xs text-muted-foreground">{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media Grid */}
      {filteredEntries.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredEntries.map((entry) => {
            const m = media[entry.media_id];
            if (!m) return null;
            return (
              <div key={entry.id} className="relative">
                <MediaCard media={m} />
                {entry.rating > 0 && (
                  <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md bg-amber-400/90 text-black text-[10px] font-bold flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-black" />
                    {entry.rating}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Még nincs média ebben a kategóriában</p>
        </div>
      )}
    </div>
  );
}