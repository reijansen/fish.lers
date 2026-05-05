import React from "react";

type Point = { label: string; value: number };

export default function LineChart({
  points,
  height = 160,
  strokeClass = "stroke-primary",
  fillClass = "fill-primary/10",
}: {
  points: Point[];
  height?: number;
  strokeClass?: string;
  fillClass?: string;
}) {
  const width = 640;
  const padX = 20;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const max = Math.max(1, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));

  const toX = (i: number) => (points.length <= 1 ? padX : padX + (i / (points.length - 1)) * innerW);
  const toY = (v: number) => padY + (1 - (v - min) / (max - min || 1)) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(p.value).toFixed(2)}`)
    .join(" ");

  const area = `${path} L ${toX(points.length - 1).toFixed(2)} ${toY(min).toFixed(2)} L ${toX(0).toFixed(
    2
  )} ${toY(min).toFixed(2)} Z`;

  const lastLabel = points[points.length - 1]?.label;
  const firstLabel = points[0]?.label;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[160px]">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="text-primary">
          <path d={area} className={`${fillClass}`} fill="url(#lineFill)" stroke="none" />
          <path d={path} className={`${strokeClass}`} fill="none" strokeWidth={2.5} strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle
              key={`${p.label}-${i}`}
              cx={toX(i)}
              cy={toY(p.value)}
              r={3.2}
              className="fill-base-100 stroke-primary"
              strokeWidth={2}
            />
          ))}
        </g>
      </svg>
      <div className="flex items-center justify-between text-[11px] text-base-content/60 mt-1">
        <span className="truncate max-w-[45%]">{firstLabel || "—"}</span>
        <span className="truncate max-w-[45%] text-right">{lastLabel || "—"}</span>
      </div>
    </div>
  );
}

