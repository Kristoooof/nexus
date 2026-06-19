const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import HeroSection from "@/components/HeroSection";
import MediaCard from "@/components/MediaCard";
import useMediaSync from "@/hooks/useMediaSync";
import { Star, TrendingUp, Clock, RefreshCw } from "lucide-react";

export default function Home() {
  const { syncing, lastSync, resync } = useMediaSync();
  const [featured, setFeatured] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!syncing) loadData();
  }, [syncing]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ft, tr, rc] = await Promise.all([
        db.entities.Media.filter({ featured: true }, "-created_date", 8),
        db.entities.Media.filter({}, "-avg_rating", 8),
        db.entities.Media.filter({}, "-created_date", 8),
      ]);
      setFeatured(ft);
      setTopRated(tr.filter((m) => m.avg_rating > 0));
      setRecent(rc);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

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
    <div>
      <HeroSection />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-16">
        {/* Featured */}
        {featured.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Star className="w-5 h-5 text-primary" />
              <h2 className="font-display text-xl font-bold text-foreground">Kiemelt</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {featured.map((m) => (
                <MediaCard key={m.id} media={m} />
              ))}
            </div>
          </section>
        )}

        {/* Top Rated */}
        {topRated.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-accent" />
              <h2 className="font-display text-xl font-bold text-foreground">Legjobbra értékelt</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {topRated.map((m) => (
                <MediaCard key={m.id} media={m} />
              ))}
            </div>
          </section>
        )}

        {/* Recently Added */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-chart-4" />
            <h2 className="font-display text-xl font-bold text-foreground">Legutóbb hozzáadva</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {recent.map((m) => (
              <MediaCard key={m.id} media={m} />
            ))}
          </div>
        </section>

        {featured.length === 0 && topRated.length === 0 && recent.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">
              Még nincs média az adatbázisban.
            </p>
            <button
              onClick={resync}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Szinkronizálás most
            </button>
            {lastSync && (
              <p className="text-xs text-muted-foreground mt-2">
                Utolsó szinkron: {new Date(lastSync).toLocaleString("hu-HU")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}