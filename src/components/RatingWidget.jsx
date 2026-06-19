import React, { useState } from "react";
import { Star } from "lucide-react";

export default function RatingWidget({ rating, onChange, size = "md" }) {
  const [hover, setHover] = useState(0);
  const current = hover || rating || 0;

  const sizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => setHover(star)}
          className="p-0.5 transition-all duration-150 hover:scale-110"
        >
          <Star
            className={`${sizes[size]} transition-colors duration-150 ${
              star <= current
                ? "text-amber-400 fill-amber-400"
                : "text-muted-foreground/30"
            }`}
            style={
              star <= current
                ? { filter: "drop-shadow(0 0 4px rgba(251, 191, 36, 0.4))" }
                : {}
            }
          />
        </button>
      ))}
      {rating > 0 && (
        <span className="ml-2 text-sm font-medium text-amber-400">{rating}/10</span>
      )}
    </div>
  );
}