const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

import RatingWidget from "@/components/RatingWidget";
import MediaStatusButton from "@/components/MediaStatusButton";
import ReviewSection from "@/components/ReviewSection";
import { Star, Clock, Calendar, Globe, User, AlertTriangle, Zap, Film, Tv, BookOpen, Gamepad2, BookMarked, Library, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import moment from "moment";

const typeLabels = {
  movie: "Film",
  series: "Sorozat",
  book: "Könyv",
  game: "Játék",
  manga: "Manga",
  manhwa: "Manhwa",
};

const typeIcons = {
  movie: Film,
  series: Tv,
  book: BookOpen,
  game: Gamepad2,
  manga: BookMarked,
  manhwa: Library,
};

const pacingLabels = {
  slow_burn: "Slow Burn",
  balanced: "Kiegyensúlyozott",
  fast_paced: "Pörgős",
};

const toneLabels = {
  dark: "Sötét",
  lighthearted: "Könnyed",
  bittersweet: "Keserédes",
  intense: "Intenzív",
  whimsical: "Szürreális",
  gritty: "Nyers / Realista",
  hopeful: "Reményteli",
};

function InfoBadge({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/10">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function MediaDetail() {
  const { id } = useParams();
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userEntry, setUserEntry] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, user] = await Promise.all([
        db.entities.Media.filter({ id }, undefined, 1),
        db.auth.me().catch(() => null),
      ]);
      const mediaItem = m[0];
      setMedia(mediaItem);
      setCurrentUser(user);

      if (user && mediaItem) {
        const entries = await db.entities.UserMediaEntry.filter(
          { user_id: user.id, media_id: mediaItem.id },
          undefined,
          1
        );
        setUserEntry(entries[0] || null);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleStatusChange = async (status) => {
    if (!currentUser || !media) return;
    if (userEntry) {
      await db.entities.UserMediaEntry.update(userEntry.id, { status });
      setUserEntry({ ...userEntry, status });
    } else {
      const created = await db.entities.UserMediaEntry.create({
        user_id: currentUser.id,
        media_id: media.id,
        status,
      });
      setUserEntry(created);
    }
  };

  const handleRatingChange = async (rating) => {
    if (!currentUser || !media) return;
    if (userEntry) {
      await db.entities.UserMediaEntry.update(userEntry.id, { rating: rating || null });
      setUserEntry({ ...userEntry, rating: rating || 0 });
    } else {
      const created = await db.entities.UserMediaEntry.create({
        user_id: currentUser.id,
        media_id: media.id,
        rating,
      });
      setUserEntry(created);
    }
    // Refresh avg rating
    const all = await db.entities.UserMediaEntry.filter({ media_id: media.id });
    const rated = all.filter((e) => e.rating > 0);
    const avg = rated.length > 0 ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : 0;
    await db.entities.Media.update(media.id, {
      avg_rating: Math.round(avg * 10) / 10,
      rating_count: rated.length,
    });
    setMedia({ ...media, avg_rating: Math.round(avg * 10) / 10, rating_count: rated.length });
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!media) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className="text-muted-foreground text-lg">Média nem található</p>
        <Link to="/discover" className="text-primary hover:underline mt-4 inline-block">
          Vissza a böngészéshez
        </Link>
      </div>
    );
  }

  const TypeIcon = typeIcons[media.type] || Film;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <Link
        to="/discover"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Vissza a böngészéshez
      </Link>

      {/* Hero Section */}
      <div className="glass-card overflow-hidden mb-8">
        <div className="md:flex">
          {/* Cover */}
          <div className="md:w-64 lg:w-80 shrink-0">
            {media.cover_image ? (
              <img
                src={media.cover_image}
                alt={media.title}
                className="w-full h-64 md:h-full object-cover"
              />
            ) : (
              <div className="w-full h-64 md:h-full min-h-[300px] bg-secondary flex items-center justify-center">
                <TypeIcon className="w-16 h-16 text-muted-foreground/20" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-6 md:p-8 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20 flex items-center gap-1">
                <TypeIcon className="w-3 h-3" />
                {typeLabels[media.type]}
              </span>
              {media.featured && (
                <span className="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-medium border border-accent/20">
                  Kiemelt
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
              {media.title}
            </h1>

            {media.creators?.length > 0 && (
              <p className="text-sm text-muted-foreground mb-4">
                {media.creators.join(" · ")}
              </p>
            )}

            {/* Rating */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <span className="font-display text-2xl font-bold text-amber-400">
                  {media.avg_rating > 0 ? media.avg_rating.toFixed(1) : "—"}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({media.rating_count || 0} értékelés)
                </span>
              </div>
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              <InfoBadge icon={Calendar} label="Megjelenés" value={media.release_year} />
              <InfoBadge
                icon={Clock}
                label="Hossz"
                value={
                  media.duration_minutes
                    ? `${media.duration_minutes} perc`
                    : media.episode_count
                    ? `${media.episode_count} epizód`
                    : media.page_count
                    ? `${media.page_count} oldal`
                    : null
                }
              />
              <InfoBadge icon={Zap} label="Pacing" value={pacingLabels[media.pacing]} />
              <InfoBadge icon={Globe} label="Nyelv" value={media.languages?.join(", ")} />
              <InfoBadge icon={User} label="Hangulat" value={toneLabels[media.tone]} />
            </div>

            {/* Description */}
            {media.description && (
              <p className="text-sm text-foreground/70 leading-relaxed">{media.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* User Actions */}
      {currentUser && (
        <div className="glass-card p-5 mb-8 space-y-4">
          <h3 className="font-display font-semibold text-lg">Saját értékelés</h3>
          <RatingWidget
            rating={userEntry?.rating || 0}
            onChange={handleRatingChange}
            size="lg"
          />
          <div>
            <p className="text-sm text-muted-foreground mb-2">Státusz</p>
            <MediaStatusButton
              status={userEntry?.status || null}
              onChange={handleStatusChange}
            />
          </div>
        </div>
      )}

      {/* Tags & Details */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Genres */}
        {media.genres?.length > 0 && (
          <div className="glass-card p-5">
            <h4 className="font-display font-semibold text-sm mb-3 text-foreground">Műfajok</h4>
            <div className="flex flex-wrap gap-1.5">
              {media.genres.map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sub Genres */}
        {media.sub_genres?.length > 0 && (
          <div className="glass-card p-5">
            <h4 className="font-display font-semibold text-sm mb-3 text-foreground">Al-műfajok</h4>
            <div className="flex flex-wrap gap-1.5">
              {media.sub_genres.map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-chart-3/10 text-chart-3 border border-chart-3/20"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags / Content Elements */}
        {media.tags?.length > 0 && (
          <div className="glass-card p-5">
            <h4 className="font-display font-semibold text-sm mb-3 text-foreground">Tartalmi elemek</h4>
            <div className="flex flex-wrap gap-1.5">
              {media.tags.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-chart-4/10 text-chart-4 border border-chart-4/20"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trigger Warnings */}
        {media.trigger_warnings?.length > 0 && (
          <div className="glass-card p-5">
            <h4 className="font-display font-semibold text-sm mb-3 text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Trigger Warning
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {media.trigger_warnings.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reviews */}
      <div>
        <h3 className="font-display font-semibold text-xl mb-4">
          Vélemények{" "}
          <span className="text-muted-foreground text-base font-normal">
            ({media.rating_count || 0})
          </span>
        </h3>
        <ReviewSection mediaId={media.id} currentUserId={currentUser?.id} />
      </div>
    </div>
  );
}