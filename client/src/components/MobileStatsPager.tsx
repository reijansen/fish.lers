import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Breakpoint = "sm" | "lg";

type StatItem = {
  label: string;
  value: number | string;
  colorClass?: string;
};

interface MobileStatsPagerProps {
  items: StatItem[];
  breakpoint?: Breakpoint;
}

export default function MobileStatsPager({ items, breakpoint = "sm" }: MobileStatsPagerProps) {
  const [start, setStart] = React.useState(0);
  const maxStart = Math.max(0, items.length - 2);
  const windowed = items.slice(start, start + 2);
  const hideClass = breakpoint === "lg" ? "lg:hidden" : "sm:hidden";

  React.useEffect(() => {
    setStart((prev) => Math.min(prev, maxStart));
  }, [maxStart]);

  return (
    <div className={`${hideClass} space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-base-content/60">
          {start + 1}-{Math.min(start + 2, items.length)} of {items.length}
        </span>
        <div className="join">
          <button
            className="btn btn-xs btn-outline join-item"
            onClick={() => setStart((prev) => Math.max(0, prev - 1))}
            disabled={start === 0}
            aria-label="Previous stats"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            className="btn btn-xs btn-outline join-item"
            onClick={() => setStart((prev) => Math.min(maxStart, prev + 1))}
            disabled={start >= maxStart}
            aria-label="Next stats"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div key={start} className="grid grid-cols-2 gap-2">
        {windowed.map((stat) => (
          <div key={stat.label} className="rounded-box bg-base-200 border border-base-300 p-2 min-h-[4.5rem]">
            <p className="text-[10px] text-base-content/70 truncate">{stat.label}</p>
            <p className={`text-2xl font-bold leading-tight ${stat.colorClass ?? ""}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

