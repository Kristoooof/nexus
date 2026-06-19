import React from "react";
import { Link } from "react-router-dom";
import { Compass, Lightbulb, Sparkles } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-primary/5 via-transparent to-accent/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/20 mb-8">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary/90">
            Média felfedező platform
          </span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-extrabold leading-none mb-6">
          <span className="gradient-text">
            Fedezd fel
            <br />
            a következő
            <br />
            kedvencedet
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground/80 mb-10 leading-relaxed">
          Filmek, sorozatok, könyvek, játékok, mangák és manhwák — egy helyen.
          Brutálisan részletes szűrőkkel és intelligens ajánlásokkal.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-display font-semibold text-base hover:opacity-90 transition-all duration-200 glow-primary"
          >
            <Compass className="w-5 h-5" />
            Böngészés indítása
          </Link>
          <Link
            to="/recommendations"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl glass border border-border/30 text-foreground font-display font-semibold text-base hover:border-primary/30 transition-all duration-200"
          >
            <Lightbulb className="w-5 h-5" />
            Ajánlások
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-md mx-auto mt-16 pt-12 border-t border-border/20">
          {[
            { label: "Média típus", value: "6" },
            { label: "Részletes szűrő", value: "15+" },
            { label: "Értékelési skála", value: "1–10" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-2xl font-bold gradient-text">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}