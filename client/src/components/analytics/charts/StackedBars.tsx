import React from "react";

export default function StackedBars({
  buckets,
  keys,
  colors,
}: {
  buckets: { label: string; values: Record<string, number>; total: number }[];
  keys: string[];
  colors: Record<string, string>;
}) {
  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => (
          <span key={k} className="badge badge-outline">
            <span className={`inline-block w-2 h-2 rounded-sm mr-2 ${colors[k]}`} />
            {k}
          </span>
        ))}
      </div>
      <div className="flex items-end gap-2 h-40">
        {buckets.map((b) => (
          <div key={b.label} className="flex-1 min-w-[10px] flex flex-col items-center gap-2">
            <div className="w-full rounded-md overflow-hidden border border-base-300 bg-base-200" style={{ height: "100%" }}>
              <div className="w-full flex flex-col-reverse h-full">
                {keys.map((k) => {
                  const v = b.values[k] || 0;
                  const pct = b.total ? (v / maxTotal) * 100 : 0;
                  return (
                    <div
                      key={`${b.label}-${k}`}
                      className={colors[k] || "bg-base-300"}
                      style={{ height: `${pct}%` }}
                      title={`${k}: ${v}`}
                    />
                  );
                })}
              </div>
            </div>
            <div className="text-[10px] text-base-content/60 truncate max-w-full">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

