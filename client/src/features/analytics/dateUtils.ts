export function resolveDate(value: any): Date | null {
  if (!value) return null;
  try {
    if (typeof value?.toDate === "function") {
      const date = value.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

export function toMillis(value: any): number {
  const d = resolveDate(value);
  return d ? d.getTime() : 0;
}

export function formatDateTime(value: any): string {
  const d = resolveDate(value);
  return d ? d.toLocaleString() : "—";
}

export function formatDateShort(value: any): string {
  const d = resolveDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function clampDateRange(from: Date, to: Date): { from: Date; to: Date } {
  const a = new Date(from);
  const b = new Date(to);
  if (a.getTime() > b.getTime()) return { from: b, to: a };
  return { from: a, to: b };
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

