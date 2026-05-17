import { NextFunction, Request, Response } from "express";

const endpointCounts = new Map<string, number>();
let reporterTimer: ReturnType<typeof setInterval> | null = null;

function normalizePath(path: string): string {
  const normalized = path
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      if (/^\d+$/.test(segment)) return ":id";
      if (/^[0-9a-f]{24}$/i.test(segment)) return ":id";
      if (/^[0-9a-f-]{32,}$/i.test(segment)) return ":id";
      return segment;
    })
    .join("/");

  return normalized || "/";
}

function endpointKey(req: Request): string {
  return `${req.method.toUpperCase()} ${normalizePath(req.path)}`;
}

export function requestMetricsMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const key = endpointKey(req);
  endpointCounts.set(key, (endpointCounts.get(key) || 0) + 1);
  next();
}

export function startRequestMetricsReporter(): void {
  if (reporterTimer) return;

  const enabled = process.env.REQUEST_METRICS_ENABLED !== "false";
  if (!enabled) return;

  const intervalMs = Math.max(10_000, Number(process.env.REQUEST_METRICS_INTERVAL_MS || 60_000));
  const topN = Math.max(1, Number(process.env.REQUEST_METRICS_TOP_N || 10));

  reporterTimer = setInterval(() => {
    if (endpointCounts.size === 0) return;

    const snapshot = Array.from(endpointCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN);
    const total = Array.from(endpointCounts.values()).reduce((sum, count) => sum + count, 0);

    console.log(`[metrics] API calls last ${Math.round(intervalMs / 1000)}s: total=${total}`);
    snapshot.forEach(([endpoint, count]) => {
      console.log(`[metrics] ${count} ${endpoint}`);
    });

    endpointCounts.clear();
  }, intervalMs);

  reporterTimer.unref?.();
}

