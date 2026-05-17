import type { AnalyticsEquipment, AnalyticsRequest, AnalyticsUser, TimeGranularity } from "./analyticsTypes";
import { formatDuration, resolveDate } from "./dateUtils";
import {
  computeCategoryDemand,
  computeEquipmentDemand,
  computePendingAging,
  computeTopRequesters,
  normalizeStatus,
} from "./analyticsSelectors";

export type InsightSeverity = "critical" | "warning" | "info";

export type Insight = {
  severity: InsightSeverity;
  title: string;
  detail: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export function buildInsights(params: {
  requestsInRange: AnalyticsRequest[];
  requestsPrevRange: AnalyticsRequest[];
  equipmentById: Record<string, AnalyticsEquipment>;
  usersById: Record<string, AnalyticsUser>;
  topCategoriesLimit?: number;
}) {
  const insights: Insight[] = [];

  const pendingAging = computePendingAging(params.requestsInRange);
  if (pendingAging.gt48 > 0) {
    insights.push({
      severity: "critical",
      title: `${pendingAging.gt48} request${pendingAging.gt48 === 1 ? "" : "s"} pending over 48 hours`,
      detail: "Approval bottleneck detected. Review aged requests to reduce wait time and prevent scheduling conflicts.",
      ctaLabel: "Review pending",
      ctaHref: "/admin/history?status=pending&quick=aged48",
    });
  }

  // Growth vs previous period (request volume)
  const currentCount = params.requestsInRange.length;
  const prevCount = params.requestsPrevRange.length;
  if (prevCount > 0) {
    const growth = Math.round(((currentCount - prevCount) / prevCount) * 100);
    if (Math.abs(growth) >= 20) {
      insights.push({
        severity: growth > 0 ? "warning" : "info",
        title: `Requests ${growth > 0 ? "up" : "down"} ${Math.abs(growth)}% vs previous period`,
        detail: "Trend shift detected. Check peak periods and category demand to adjust staffing and inventory planning.",
        ctaLabel: "View trends",
        ctaHref: "/analytics#trend",
      });
    }
  }

  // Concentration: top users share
  const topRequesters = computeTopRequesters(params.requestsInRange);
  if (topRequesters.length >= 5 && currentCount > 0) {
    const top5 = topRequesters.slice(0, 5).reduce((sum, [, c]) => sum + c, 0);
    const share = Math.round((top5 / currentCount) * 100);
    if (share >= 55) {
      insights.push({
        severity: "info",
        title: `Top 5 users account for ${share}% of requests`,
        detail: "High concentration can indicate a power-user group or a single cohort’s workload. Consider bulk approvals or inventory allocation.",
        ctaLabel: "See requesters",
        ctaHref: "/analytics#users",
      });
    }
  }

  // Equipment wear risk: qty normalized by inventory
  const demand = computeEquipmentDemand(params.requestsInRange, params.equipmentById);
  const risky = demand
    .map((d) => ({ ...d, score: d.inventory > 0 ? d.qty / d.inventory : d.qty }))
    .sort((a, b) => b.score - a.score)[0];
  if (risky && risky.qty > 0 && risky.score >= 5) {
    insights.push({
      severity: "warning",
      title: `${risky.name} is heavily used (wear risk)`,
      detail: `Requested qty ${risky.qty} relative to inventory ${risky.inventory || "—"}. Consider maintenance checks or adding stock.`,
      ctaLabel: "View equipment",
      ctaHref: "/inventory",
    });
  }

  // Category shift: biggest growth category by qty
  const currentCat = computeCategoryDemand(demand).byCategory;
  const prevDemand = computeEquipmentDemand(params.requestsPrevRange, params.equipmentById);
  const prevCat = computeCategoryDemand(prevDemand).byCategory;
  let best: { category: string; growthPct: number } | null = null;
  for (const category of Object.keys(currentCat)) {
    const c = currentCat[category] || 0;
    const p = prevCat[category] || 0;
    if (p <= 0) continue;
    const growthPct = Math.round(((c - p) / p) * 100);
    if (!best || growthPct > best.growthPct) best = { category, growthPct };
  }
  if (best && best.growthPct >= 25) {
    insights.push({
      severity: "info",
      title: `${best.category} demand increased ${best.growthPct}%`,
      detail: "Consider rebalancing inventory and adding quick actions for common items in this category.",
      ctaLabel: "Open category",
      ctaHref: "/analytics#equipment",
    });
  }

  // Anomaly: daily spike detection (simple rule)
  const dailyCounts = new Map<string, number>();
  for (const r of params.requestsInRange) {
    const d = resolveDate(r.createdAtClient || r.createdAt);
    if (!d) continue;
    const key = d.toISOString().slice(0, 10);
    dailyCounts.set(key, (dailyCounts.get(key) || 0) + 1);
  }
  const values = Array.from(dailyCounts.values());
  if (values.length >= 7) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
    const std = Math.sqrt(variance);
    const spike = Array.from(dailyCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (spike && spike[1] > mean + 2 * std) {
      insights.push({
        severity: "warning",
        title: `Demand spike detected on ${spike[0]}`,
        detail: "A single day exceeded normal volume. Check the peak-period heatmap and status trend for operational impact.",
        ctaLabel: "Inspect heatmap",
        ctaHref: "/analytics#trend",
      });
    }
  }

  // Sort: critical -> warning -> info
  const weight: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) => weight[a.severity] - weight[b.severity]);
  return insights;
}

