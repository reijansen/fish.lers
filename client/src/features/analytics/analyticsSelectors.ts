import type {
  AnalyticsEquipment,
  AnalyticsFilters,
  AnalyticsRequest,
  AnalyticsUser,
  TimeGranularity,
} from "./analyticsTypes";
import { endOfDay, resolveDate, startOfDay, toMillis } from "./dateUtils";
import { normalizeRequestItems } from "./normalize";


export type SeriesPoint = { key: string; label: string; value: number; startMs: number };
export type StackedSeriesPoint = {
  key: string;
  label: string;
  startMs: number;
  values: Record<string, number>;
  total: number;
};

export type InventoryAlert = {
  equipmentID: string;
  equipmentName: string;
  inventory: number;
  activeQty: number;
  upcomingQty: number;
  available: number;
  pressurePct: number;
  severity: "green" | "yellow" | "red";
};

export type ReservationConflict = {
  equipmentID: string;
  equipmentName: string;
  date: string;
  requestedQty: number;
  inventory: number;
  shortage: number;
};


export function buildUserLabelMap(users: AnalyticsUser[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const u of users) {
    if (!u?.uid) continue;
    map[u.uid] = u.displayName?.trim() || u.email?.trim() || u.uid;
  }
  return map;
}

export function resolveRequesterLabel(userId: string | undefined, labelMap: Record<string, string>): string {
  if (!userId) return "Unlinked requester";
  return labelMap[userId] || userId;
}

export function normalizeStatus(value: string | undefined): string {
  const key = (value || "").toLowerCase().trim();
  if (!key) return "pending";
  if (key === "declined") return "rejected";
  return key;
}

export function filterRequests(
  requests: AnalyticsRequest[],
  usersById: Record<string, AnalyticsUser>,
  equipmentById: Record<string, AnalyticsEquipment>,
  filters: AnalyticsFilters
) {
  const fromMs = startOfDay(filters.dateFrom).getTime();
  const toMs = endOfDay(filters.dateTo).getTime();

  return requests.filter((r) => {
    const created = resolveDate(r.createdAtClient || r.createdAt);
    const createdMs = created ? created.getTime() : 0;
    if (!createdMs || createdMs < fromMs || createdMs > toMs) return false;

    const status = normalizeStatus(r.status as any);
    if (filters.status !== "all" && status !== filters.status) return false;

    const requesterId = r.createdBy || r.userID;
    if (filters.userType !== "all") {
      const role = usersById[requesterId || ""]?.role || "student";
      if (role !== filters.userType) return false;
    }

    if (filters.equipmentCategory !== "all") {
      const items = normalizeRequestItems(r.items);
      const matches = items.some((it) => {
        if (!it.equipmentID) return false;
        const cat = (equipmentById[it.equipmentID]?.category || "Uncategorized").trim();
        return cat === filters.equipmentCategory;
      });
      if (!matches) return false;
    }

    return true;
  });
}

function bucketStartMs(date: Date, granularity: TimeGranularity): number {
  if (granularity === "daily") {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
  }
  if (granularity === "weekly") {
    const d = new Date(date);
    const day = d.getDay(); // 0..6 (Sun..Sat)
    const mondayOffset = (day + 6) % 7; // convert to Monday=0
    d.setDate(d.getDate() - mondayOffset);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
}

function bucketLabel(startMs: number, granularity: TimeGranularity): string {
  const d = new Date(startMs);
  if (granularity === "daily") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (granularity === "weekly") {
    const end = new Date(startMs);
    end.setDate(end.getDate() + 6);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}`;
  }
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function computeRequestsSeries(requests: AnalyticsRequest[], granularity: TimeGranularity): SeriesPoint[] {
  const points = new Map<number, number>();
  for (const r of requests) {
    const created = resolveDate(r.createdAtClient || r.createdAt);
    if (!created) continue;
    const key = bucketStartMs(created, granularity);
    points.set(key, (points.get(key) || 0) + 1);
  }
  return Array.from(points.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([startMs, value]) => ({
      key: String(startMs),
      label: bucketLabel(startMs, granularity),
      value,
      startMs,
    }));
}

export function computeStatusStackedSeries(
  requests: AnalyticsRequest[],
  granularity: TimeGranularity,
  statuses: string[]
): StackedSeriesPoint[] {
  const map = new Map<number, Record<string, number>>();
  for (const r of requests) {
    const created = resolveDate(r.createdAtClient || r.createdAt);
    if (!created) continue;
    const startMs = bucketStartMs(created, granularity);
    const bucket = map.get(startMs) || {};
    const status = normalizeStatus(r.status as any);
    bucket[status] = (bucket[status] || 0) + 1;
    map.set(startMs, bucket);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([startMs, values]) => {
      const normalized: Record<string, number> = {};
      let total = 0;
      for (const s of statuses) {
        const v = values[s] || 0;
        normalized[s] = v;
        total += v;
      }
      return {
        key: String(startMs),
        label: bucketLabel(startMs, granularity),
        startMs,
        values: normalized,
        total,
      };
    });
}

export function computeHeatmap(requests: AnalyticsRequest[]) {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of requests) {
    const d = resolveDate(r.createdAtClient || r.createdAt);
    if (!d) continue;
    const weekday = (d.getDay() + 6) % 7; // Monday=0
    const hour = d.getHours();
    grid[weekday][hour] += 1;
  }
  return grid;
}

export function computeApprovalMetrics(requests: AnalyticsRequest[]) {
  const completed = requests.filter((r) => {
    const status = normalizeStatus(r.status as any);
    return status === "approved" || status === "rejected";
  });

  const approved = completed.filter((r) => normalizeStatus(r.status as any) === "approved").length;
  const rejected = completed.length - approved;
  const approvalRate = completed.length ? Math.round((approved / completed.length) * 100) : 0;

  const turnaroundMs: number[] = [];
  for (const r of completed) {
    const created = resolveDate(r.createdAtClient || r.createdAt);
    const done = resolveDate(r.approvedAt || r.rejectedAt);
    if (!created || !done) continue;
    const diff = done.getTime() - created.getTime();
    if (diff > 0) turnaroundMs.push(diff);
  }
  const avgTurnaroundMs = turnaroundMs.length ? turnaroundMs.reduce((a, b) => a + b, 0) / turnaroundMs.length : 0;

  return { approved, rejected, approvalRate, avgTurnaroundMs, completedCount: completed.length };
}

export function computePendingAging(requests: AnalyticsRequest[]) {
  const nowMs = Date.now();
  const buckets = { lt24: 0, h24to48: 0, gt48: 0 };
  const pending = requests.filter((r) => normalizeStatus(r.status as any) === "pending");
  for (const r of pending) {
    const createdMs = toMillis(r.createdAtClient || r.createdAt);
    if (!createdMs) continue;
    const ageHrs = (nowMs - createdMs) / 3600000;
    if (ageHrs < 24) buckets.lt24 += 1;
    else if (ageHrs < 48) buckets.h24to48 += 1;
    else buckets.gt48 += 1;
  }
  return { ...buckets, total: pending.length };
}

export function computeEquipmentDemand(
  requests: AnalyticsRequest[],
  equipmentById: Record<string, AnalyticsEquipment>
) {
  const byEquipment: Record<string, { equipmentID: string; name: string; qty: number; category: string; isDisposable: boolean; inventory: number }> =
    {};

  for (const r of requests) {
    const status = normalizeStatus(r.status as any);
    if (status === "cancelled") continue;
    const items = normalizeRequestItems(r.items);
    for (const item of items) {
      const equipmentID = item.equipmentID;
      if (!equipmentID) continue;
      const eq = equipmentById[equipmentID];
      const name = eq?.name || item.name || equipmentID;
      const category = (eq?.category || "Uncategorized").trim();
      const isDisposable = !!eq?.isDisposable;
      const inventory = eq?.totalInventory || 0;
      const entry = byEquipment[equipmentID] || {
        equipmentID,
        name,
        qty: 0,
        category,
        isDisposable,
        inventory,
      };
      entry.qty += item.qty || 0;
      byEquipment[equipmentID] = entry;
    }
  }

  const all = Object.values(byEquipment).sort((a, b) => b.qty - a.qty);
  return all;
}

export function computeCategoryDemand(equipmentDemand: ReturnType<typeof computeEquipmentDemand>) {
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const e of equipmentDemand) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.qty;
    total += e.qty;
  }
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  return { byCategory, sorted, total };
}

export function computeDisposableReusableTrend(
  requests: AnalyticsRequest[],
  granularity: TimeGranularity,
  equipmentById: Record<string, AnalyticsEquipment>
) {
  const map = new Map<number, { disposable: number; reusable: number }>();

  for (const r of requests) {
    const status = normalizeStatus(r.status as any);
    if (status === "cancelled") continue;
    const created = resolveDate(r.createdAtClient || r.createdAt);
    if (!created) continue;
    const startMs = bucketStartMs(created, granularity);
    const bucket = map.get(startMs) || { disposable: 0, reusable: 0 };
    for (const it of normalizeRequestItems(r.items)) {
      if (!it.equipmentID) continue;
      const eq = equipmentById[it.equipmentID];
      const qty = it.qty || 0;
      if (eq?.isDisposable) bucket.disposable += qty;
      else bucket.reusable += qty;
    }
    map.set(startMs, bucket);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([startMs, values]) => ({
      key: String(startMs),
      label: bucketLabel(startMs, granularity),
      startMs,
      ...values,
      total: values.disposable + values.reusable,
    }));
}

export function computeEquipmentUtilizationRate(
  requests: AnalyticsRequest[],
  equipmentById: Record<string, AnalyticsEquipment>
): { utilizationPct: number; activeQty: number; totalInventory: number } {
  const active = requests.filter((r) => normalizeStatus(r.status as any) === "ongoing");
  const activeQty = active.reduce((sum, r) => {
    const items = normalizeRequestItems(r.items);
    return sum + items.reduce((inner, it) => inner + (it.qty || 0), 0);
  }, 0);

  const totalInventory = Object.values(equipmentById).reduce((sum, e) => sum + (e.totalInventory || 0), 0);
  const utilizationPct = totalInventory ? Math.min(100, Math.round((activeQty / totalInventory) * 100)) : 0;
  return { utilizationPct, activeQty, totalInventory };
}

export function computeTopRequesters(requests: AnalyticsRequest[]) {
  const byUser: Record<string, number> = {};
  for (const r of requests) {
    const userId = r.createdBy || r.userID || "";
    if (!userId) continue;
    byUser[userId] = (byUser[userId] || 0) + 1;
  }
  return Object.entries(byUser).sort((a, b) => b[1] - a[1]);
}

export function computeRequestsByRole(
  requests: AnalyticsRequest[],
  usersById: Record<string, AnalyticsUser>
) {
  const byRole: Record<string, number> = {};
  for (const r of requests) {
    const uid = r.createdBy || r.userID || "";
    const role = (usersById[uid]?.role || "student").toString();
    byRole[role] = (byRole[role] || 0) + 1;
  }
  const sorted = Object.entries(byRole).sort((a, b) => b[1] - a[1]);
  return { byRole, sorted, total: requests.length };
}

export function computeCancellationFlags(requests: AnalyticsRequest[]) {
  const byUser: Record<string, number> = {};
  for (const r of requests) {
    const status = normalizeStatus(r.status as any);
    if (status !== "cancelled") continue;
    const uid = r.createdBy || r.userID || "";
    if (!uid) continue;
    byUser[uid] = (byUser[uid] || 0) + 1;
  }
  return Object.entries(byUser).sort((a, b) => b[1] - a[1]);
}

export function computeInventoryShortageAlerts(
  requests: AnalyticsRequest[],
  equipmentById: Record<string, AnalyticsEquipment>
): InventoryAlert[] {
  const activeMap: Record<string, number> = {};
  const upcomingMap: Record<string, number> = {};

  for (const r of requests) {
    const status = normalizeStatus(r.status as any);
    if (status === "ongoing") {
      for (const item of normalizeRequestItems(r.items)) {
        if (!item.equipmentID) continue;

        activeMap[item.equipmentID] =
          (activeMap[item.equipmentID] || 0) + (item.qty || 0);
      }
    }

    if (status === "approved") {
      for (const item of normalizeRequestItems(r.items)) {
        if (!item.equipmentID) continue;

        upcomingMap[item.equipmentID] =
          (upcomingMap[item.equipmentID] || 0) + (item.qty || 0);
      }
    }
  }

  const alerts: InventoryAlert[] = [];

  for (const equipmentID of Object.keys(equipmentById)) {
    const eq = equipmentById[equipmentID];

    const inventory = eq.totalInventory || 0;
    const activeQty = activeMap[equipmentID] || 0;
    const upcomingQty = upcomingMap[equipmentID] || 0;

    const reserved = activeQty + upcomingQty;
    const available = inventory - reserved;

    const pressurePct =
      inventory > 0
        ? Math.round((reserved / inventory) * 100)
        : 0;

    let severity: "green" | "yellow" | "red" = "green";

    if (pressurePct >= 90 || available <= 0) {
      severity = "red";
    } else if (pressurePct >= 70) {
      severity = "yellow";
    }

    if (severity !== "green") {
      alerts.push({
        equipmentID,
        equipmentName: eq.name,
        inventory,
        activeQty,
        upcomingQty,
        available,
        pressurePct,
        severity,
      });
    }
  }

  return alerts.sort((a, b) => b.pressurePct - a.pressurePct);
}

export function computeReservationConflicts(
  requests: AnalyticsRequest[],
  equipmentById: Record<string, AnalyticsEquipment>
): ReservationConflict[] {
  const dailyUsage: Record<
    string,
    Record<string, number>
  > = {};

  for (const r of requests) {
    const status = normalizeStatus(r.status as any);

    if (
      status !== "approved" &&
      status !== "ongoing"
    ) {
      continue;
    }

    const start = resolveDate(r.startDate);
    const end = resolveDate(r.endDate);

    if (!start || !end) continue;

    for (
      let d = new Date(start);
      d <= end;
      d.setDate(d.getDate() + 1)
    ) {
      const dateKey = d.toISOString().slice(0, 10);

      if (!dailyUsage[dateKey]) {
        dailyUsage[dateKey] = {};
      }

      for (const item of normalizeRequestItems(r.items)) {
        if (!item.equipmentID) continue;

        dailyUsage[dateKey][item.equipmentID] =
          (dailyUsage[dateKey][item.equipmentID] || 0) +
          (item.qty || 0);
      }
    }
  }

  const conflicts: ReservationConflict[] = [];

  for (const date of Object.keys(dailyUsage)) {
    const equipmentUsage = dailyUsage[date];

    for (const equipmentID of Object.keys(equipmentUsage)) {
      const requestedQty = equipmentUsage[equipmentID];
      const inventory =
        equipmentById[equipmentID]?.totalInventory || 0;

      if (requestedQty > inventory) {
        conflicts.push({
          equipmentID,
          equipmentName:
            equipmentById[equipmentID]?.name || equipmentID,
          date,
          requestedQty,
          inventory,
          shortage: requestedQty - inventory,
        });
      }
    }
  }

  return conflicts.sort((a, b) => b.shortage - a.shortage);
}