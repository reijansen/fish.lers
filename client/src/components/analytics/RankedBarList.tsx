import React from "react";

export default function RankedBarList({
  items,
  valueLabel,
  onItemClick,
}: {
  items: { key: string; label: string; value: number; meta?: React.ReactNode }[];
  valueLabel?: (value: number) => string;
  onItemClick?: (key: string) => void;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it, idx) => {
        const pct = (it.value / max) * 100;
        return (
          <button
            type="button"
            key={it.key}
            className={`w-full text-left rounded-box border border-base-300 bg-base-100 hover:bg-primary/5 transition-colors p-3 ${
              onItemClick ? "cursor-pointer" : "cursor-default"
            }`}
            onClick={onItemClick ? () => onItemClick(it.key) : undefined}
            disabled={!onItemClick}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="badge badge-outline shrink-0">{idx + 1}</span>
                  <span className="font-semibold truncate">{it.label}</span>
                </div>
                {it.meta && <div className="text-xs text-base-content/60 mt-1">{it.meta}</div>}
              </div>
              <div className="shrink-0 text-sm font-semibold">{valueLabel ? valueLabel(it.value) : it.value}</div>
            </div>
            <div className="mt-2 h-2 bg-base-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(4, pct)}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

