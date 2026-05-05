import React from "react";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Heatmap({
  grid,
}: {
  grid: number[][];
}) {
  const max = Math.max(1, ...grid.flat());
  const cellClass = (v: number) => {
    const r = v / max;
    if (r === 0) return "bg-base-200";
    if (r < 0.25) return "bg-primary/15";
    if (r < 0.5) return "bg-primary/25";
    if (r < 0.75) return "bg-primary/40";
    return "bg-primary/60";
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[52px_repeat(24,minmax(0,1fr))] gap-1">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[10px] text-base-content/60 text-center">
              {h}
            </div>
          ))}
          {grid.map((row, i) => (
            <React.Fragment key={i}>
              <div className="text-[11px] font-medium text-base-content/70 flex items-center">{weekdays[i]}</div>
              {row.map((v, h) => (
                <div
                  key={`${i}-${h}`}
                  className={`h-6 rounded-md border border-base-300/60 ${cellClass(v)}`}
                  title={`${weekdays[i]} ${h}:00 — ${v} request${v === 1 ? "" : "s"}`}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] text-base-content/60 mt-2">
          <span>Lower</span>
          <div className="flex items-center gap-1">
            {[0, 0.2, 0.4, 0.6, 0.8].map((p) => (
              <span
                key={p}
                className={`w-5 h-3 rounded border border-base-300/60 ${
                  p === 0 ? "bg-base-200" : p < 0.3 ? "bg-primary/15" : p < 0.5 ? "bg-primary/25" : p < 0.7 ? "bg-primary/40" : "bg-primary/60"
                }`}
              />
            ))}
          </div>
          <span>Higher</span>
        </div>
      </div>
    </div>
  );
}

