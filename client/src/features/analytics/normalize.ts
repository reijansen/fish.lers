import type { AnalyticsRequestItem } from "./analyticsTypes";

export function normalizeRequestItems(items: any[] | undefined): AnalyticsRequestItem[] {
  if (!Array.isArray(items)) return [];
  const normalized: AnalyticsRequestItem[] = [];

  for (const raw of items) {
    if (!raw) continue;
    if (typeof raw === "string") {
      normalized.push({ name: raw, qty: 1 });
      continue;
    }
    if (typeof raw === "number") {
      normalized.push({ name: "Item", qty: raw });
      continue;
    }
    if (typeof raw === "object") {
      const equipmentID = raw.equipmentID || raw.equipmentId || raw.id;
      const name = raw.name || raw.item || raw.label;
      const qty = typeof raw.qty === "number" ? raw.qty : typeof raw.quantity === "number" ? raw.quantity : 1;
      normalized.push({ equipmentID, name, qty: Math.max(0, qty) });
    }
  }

  return normalized;
}

