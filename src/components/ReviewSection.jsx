const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import { Star, AlertTriangle, User as UserIcon, Trash2 } from "lucide-react";
import moment from "moment";

export default function ReviewSection({ mediaId, currentUserId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newReview, setNewReview] = useState("");
  const [newRating, setNewRating] = useState(0);
  const [newSpoiler, setNewSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [myEntry, setMyEntry] = useState(null);

  const loadEntries = async () => {
    setLoading(true);
    const all = await db.entities.UserMediaEntry.filter({ media_id: mediaId }, "-created_date", 50);
    setEntries(all.filter((e) => e.review));
    const mine = all.find((e) => e.user_id === currentUserId);
    setMyEntry(mine || null);
    if (mine?.review) {
      setNewReview(mine.review);
    }
    if (mine?.rating) {
      setNewRating(mine.rating);
    }
    if (mine?.spoiler_flag) {
      setNewSpoiler(mine.spoiler_flag);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEntries();
  }, [mediaId]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newReview.trim() && !newRating) return;
    setSubmitting(true);

    if (myEntry) {
      await db.entities.UserMediaEntry.update(myEntry.id, {
        review: newReview,
        rating: newRating || null,
        spoiler_flag: newSpoiler,
        media_id: mediaId,
        user_id: currentUserId,
      });
    } else {
      await db.entities.UserMediaEntry.create({
        media_id: mediaId,
        user_id: currentUserId,
        review: newReview,
        rating: newRating || null,
        spoiler_flag: newSpoiler,
      });
    }

    await updateMediaAvgRating();
    setSubmitting(false);
    loadEntries();
  };

  const updateMediaAvgRating = async () => {
    const all = await db.entities.UserMediaEntry.filter({ media_id: mediaId });
    const rated = all.filter((e) => e.rating > 0);
    const avg = rated.length > 0 ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : 0;
    await db.entities.Media.update(mediaId, {
      avg_rating: Math.round(avg * 10) / 10,
      rating_count: rated.length,
    });
  };

  const handleDeleteReview = async () => {
    if (!myEntry) return;
    await db.entities.UserMediaEntry.update(myEntry.id, { review: null, rating: null });
    setNewReview("");
    setNewRating(0);
    setNewSpoiler(false);
    await updateMediaAvgRating();
    loadEntries();
  };

  return (
    <div className="space-y-6">
      {/* Write Review */}
      <div className="glass-card p-5">
        <h4 className="font-display font-semibold text-lg mb-4">Írj véleményt</h4>
        <form onSubmit={handleSubmitReview} className="space-y-4">
          {/* Rating */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Értékelés (1-10)</p>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setNewRating(star === newRating ? 0 : star)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all duration-150 ${
                    star <= newRating
                      ? "bg-amber-400/20 text-amber-400 border border-amber-400/40"
                      : "bg-secondary/30 text-muted-foreground border border-border/10"
                  }`}
                >
                  {star}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={newReview}
            onChange={(e) => setNewReview(e.target.value)}
            placeholder="Oszd meg a gondolataidat..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-secondary/30 border border-border/20 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={newSpoiler}
                onChange={(e) => setNewSpoiler(e.target.checked)}
                className="rounded accent-primary"
              />
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Spoiler-t tartalmaz
            </label>
            <div className="flex items-center gap-2">
              {myEntry?.review && (
                <button
                  type="button"
                  onClick={handleDeleteReview}
                  className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || (!newReview.trim() && !newRating)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Küldés..." : "Közzététel"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Betöltés...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Még nincsenek vélemények. Legyél te az első!
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {entry.user_id === currentUserId ? "Te" : "Felhasználó"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {moment(entry.created_date).format("YYYY. MMM D.")}
                    </p>
                  </div>
                </div>
                {entry.rating > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">{entry.rating}/10</span>
                  </div>
                )}
              </div>

              {entry.spoiler_flag ? (
                <details className="group">
                  <summary className="text-sm text-amber-400 cursor-pointer hover:text-amber-300 transition-colors flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Spoiler tartalom megjelenítése
                  </summary>
                  <p className="mt-2 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {entry.review}
                  </p>
                </details>
              ) : (
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {entry.review}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}