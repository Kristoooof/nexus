import React from "react";
import { Link } from "react-router-dom";
import { Star, Clock, BookOpen, Film, Tv, Gamepad2, BookMarked, Library } from "lucide-react";

const typeIcons = {
  movie: Film,
  series: Tv,
  book: BookOpen,
  game: Gamepad2,
  manga: BookMarked,
  manhwa: Library,
};

const typeLabels = {
  movie: "Film",
  series: "Sorozat",
  book: "Könyv",
  game: "Játék",
  manga: "Manga",
  manhwa: "Manhwa",
};

export default function MediaCard({ media }) {
  const TypeIcon = typeIcons[media.type] || Film;

  return (
    <Link
      to={`/media/${media.id}`}
      className="group glass-card overflow-hidden hover:glow-primary transition-all duration-500 hover:-translate-y-1"
    >
      {/* Cover Image */}
      <div className="aspect-[2/3] overflow-hidden relative">
        {media.cover_image ? (
          <img
            src={media.cover_image}
            alt={media.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <TypeIcon className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Type Badge */}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-background/80 backdrop-blur-sm text-[10px] font-medium text-muted-foreground border border-border/30 flex items-center gap-1">
          <TypeIcon className="w-3 h-3" />
          {typeLabels[media.type]}
        </span>

        {/* Rating Badge */}
        {media.avg_rating > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-background/80 backdrop-blur-sm text-[10px] font-medium text-accent flex items-center gap-1">
            <Star className="w-3 h-3 fill-accent" />
            {media.avg_rating.toFixed(1)}
          </span>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-display font-semibold text-sm text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {media.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          {media.release_year && <span>{media.release_year}</span>}
          {media.duration_minutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {media.duration_minutes}p
            </span>
          )}
          {media.episode_count > 0 && <span>{media.episode_count} ep.</span>}
          {media.page_count > 0 && <span>{media.page_count} o.</span>}
        </div>

        {/* Genres */}
        {media.genres && media.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {media.genres.slice(0, 2).map((g) => (
              <span
                key={g}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary/50 text-muted-foreground border border-border/20"
              >
                {g}
              </span>
            ))}
            {media.genres.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{media.genres.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}