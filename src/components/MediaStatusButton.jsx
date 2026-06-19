import React from "react";
import { CheckCircle, Clock, XCircle } from "lucide-react";

const statuses = [
  { value: "watched", icon: CheckCircle, label: "Megnéztem / Olvastam" },
  { value: "planned", icon: Clock, label: "Tervezem" },
  { value: "dropped", icon: XCircle, label: "Abbahagytam" },
];

export default function MediaStatusButton({ status, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => {
        const isActive = status === s.value;
        const Icon = s.icon;
        return (
          <button
            key={s.value}
            onClick={() => onChange(isActive ? null : s.value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-secondary/40 text-muted-foreground border border-border/20 hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? "text-primary" : ""}`} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}