import React, { useState } from "react";
import { X, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";

const typeOptions = [
  { value: "movie", label: "Film" },
  { value: "series", label: "Sorozat" },
  { value: "book", label: "Könyv" },
  { value: "game", label: "Játék" },
  { value: "manga", label: "Manga" },
  { value: "manhwa", label: "Manhwa" },
];

const pacingOptions = [
  { value: "slow_burn", label: "Slow Burn" },
  { value: "balanced", label: "Kiegyensúlyozott" },
  { value: "fast_paced", label: "Pörgős" },
];

const toneOptions = [
  { value: "dark", label: "Sötét" },
  { value: "lighthearted", label: "Könnyed" },
  { value: "bittersweet", label: "Keserédes" },
  { value: "intense", label: "Intenzív" },
  { value: "whimsical", label: "Szürreális" },
  { value: "gritty", label: "Nyers / Realista" },
  { value: "hopeful", label: "Reményteli" },
];

function FilterSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/30 pb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
}

function MultiSelect({ options, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => {
              if (isSelected) {
                onChange(selected.filter((v) => v !== opt.value));
              } else {
                onChange([...selected, opt.value]);
              }
            }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/20"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function FilterDrawer({ filters, onChange, availableGenres, availableTags, availableTriggerWarnings }) {
  const [open, setOpen] = useState(false);

  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key, value) => {
    const current = filters[key] || [];
    if (current.includes(value)) {
      updateFilter(key, current.filter((v) => v !== value));
    } else {
      updateFilter(key, [...current, value]);
    }
  };

  const clearAll = () => {
    onChange({
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
      search: filters.search || "",
    });
  };

  const hasFilters =
    (filters.types?.length > 0) ||
    (filters.genres?.length > 0) ||
    (filters.pacing?.length > 0) ||
    (filters.tone?.length > 0) ||
    (filters.tags?.length > 0) ||
    (filters.excludeTriggers?.length > 0) ||
    filters.yearFrom ||
    filters.yearTo ||
    filters.durationMin ||
    filters.durationMax ||
    filters.ratingMin ||
    filters.language;

  return (
    <>
      {/* Mobile / Desktop trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          hasFilters
            ? "bg-primary/20 text-primary border border-primary/30"
            : "bg-secondary/50 text-muted-foreground border border-border/20 hover:bg-secondary hover:text-foreground"
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        Szűrők
        {hasFilters && (
          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
            {(
              (filters.types?.length || 0) +
              (filters.genres?.length || 0) +
              (filters.pacing?.length || 0) +
              (filters.tone?.length || 0) +
              (filters.tags?.length || 0) +
              (filters.excludeTriggers?.length || 0) +
              (filters.language ? 1 : 0) +
              (filters.ratingMin ? 1 : 0) +
              (filters.yearFrom || filters.yearTo ? 1 : 0) +
              (filters.durationMin || filters.durationMax ? 1 : 0)
            )}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-80 sm:w-96 bg-card border-l border-border/30 z-50 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <h3 className="font-display font-semibold text-lg">Szűrők</h3>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="text-xs text-accent hover:underline"
                >
                  Összes törlése
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-2">
            <FilterSection title="Média típus" defaultOpen={true}>
              <MultiSelect
                options={typeOptions}
                selected={filters.types || []}
                onChange={(v) => updateFilter("types", v)}
              />
            </FilterSection>

            {availableGenres?.length > 0 && (
              <FilterSection title="Műfaj (Genre)">
                <MultiSelect
                  options={availableGenres.map((g) => ({ value: g, label: g }))}
                  selected={filters.genres || []}
                  onChange={(v) => updateFilter("genres", v)}
                />
              </FilterSection>
            )}

            <FilterSection title="Pacing">
              <MultiSelect
                options={pacingOptions}
                selected={filters.pacing || []}
                onChange={(v) => updateFilter("pacing", v)}
              />
            </FilterSection>

            <FilterSection title="Hangulat / Tone">
              <MultiSelect
                options={toneOptions}
                selected={filters.tone || []}
                onChange={(v) => updateFilter("tone", v)}
              />
            </FilterSection>

            {availableTags?.length > 0 && (
              <FilterSection title="Tartalmi elemek">
                <MultiSelect
                  options={availableTags.map((t) => ({ value: t, label: t }))}
                  selected={filters.tags || []}
                  onChange={(v) => updateFilter("tags", v)}
                />
              </FilterSection>
            )}

            {availableTriggerWarnings?.length > 0 && (
              <FilterSection title="Trigger Warning (kizárás)">
                <MultiSelect
                  options={availableTriggerWarnings.map((t) => ({ value: t, label: t }))}
                  selected={filters.excludeTriggers || []}
                  onChange={(v) => updateFilter("excludeTriggers", v)}
                />
              </FilterSection>
            )}

            {/* Range Filters */}
            <div className="border-b border-border/30 pb-4 space-y-3 pt-2">
              <p className="text-sm font-medium text-foreground">Megjelenési év</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Tól"
                  value={filters.yearFrom || ""}
                  onChange={(e) => updateFilter("yearFrom", e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/20 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <input
                  type="number"
                  placeholder="Ig"
                  value={filters.yearTo || ""}
                  onChange={(e) => updateFilter("yearTo", e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/20 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div className="border-b border-border/30 pb-4 space-y-3 pt-2">
              <p className="text-sm font-medium text-foreground">Hossz (perc)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.durationMin || ""}
                  onChange={(e) => updateFilter("durationMin", e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/20 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.durationMax || ""}
                  onChange={(e) => updateFilter("durationMax", e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/20 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div className="border-b border-border/30 pb-4 space-y-3 pt-2">
              <p className="text-sm font-medium text-foreground">Minimum értékelés</p>
              <input
                type="range"
                min="1"
                max="10"
                value={filters.ratingMin || 1}
                onChange={(e) => updateFilter("ratingMin", e.target.value === "1" ? "" : e.target.value)}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span className="text-accent font-medium">{filters.ratingMin || "1"}+</span>
                <span>10</span>
              </div>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Nyelv</p>
              <input
                type="text"
                placeholder="Pl. Magyar, English, 日本語..."
                value={filters.language || ""}
                onChange={(e) => updateFilter("language", e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/20 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}