import React from "react";

export default function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  onClick,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "warning" | "success" | "danger" | "info";
  onClick?: () => void;
  footer?: React.ReactNode;
}) {
  const toneRing =
    tone === "warning"
      ? "ring-warning/25"
      : tone === "success"
      ? "ring-success/25"
      : tone === "danger"
      ? "ring-error/25"
      : tone === "info"
      ? "ring-info/25"
      : "ring-primary/20";

  return (
    <button
      type="button"
      className={`card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow text-left ring-1 ${toneRing} ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="card-body p-4 sm:p-5 gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-base-content/60 truncate">{label}</p>
            <div className="text-2xl sm:text-3xl font-extrabold leading-tight">{value}</div>
            {hint && <p className="text-xs text-base-content/60 mt-1">{hint}</p>}
          </div>
          {icon && (
            <div className="shrink-0 rounded-xl border border-base-300 bg-base-200/60 p-2.5">
              {icon}
            </div>
          )}
        </div>
        {footer && <div className="pt-2 border-t border-base-300/70">{footer}</div>}
      </div>
    </button>
  );
}

