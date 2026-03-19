"use client";

import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  stars: number;
  onChange: (stars: number) => void;
}

export function StarRating({ stars, onChange }: StarRatingProps) {
  const [hoverStar, setHoverStar] = useState(0);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoverStar(star)}
          onMouseLeave={() => setHoverStar(0)}
          className="p-0.5 hover:scale-110 transition-transform"
        >
          <Star
            className={`h-4 w-4 ${
              star <= (hoverStar || stars)
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}