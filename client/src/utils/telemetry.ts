type TelemetryKind =
  | "super_admin_api_failure"
  | "unauthorized_route_hit"
  | "action_latency";

export type TelemetryEvent = {
  kind: TelemetryKind;
  timestamp: string;
  path?: string;
  action?: string;
  endpoint?: string;
  status?: number;
  message?: string;
  actorRole?: string;
  isSuperAdmin?: boolean;
  latencyMs?: number;
  success?: boolean;
  context?: Record<string, unknown>;
};

const STORAGE_KEY = "debugTelemetryEvents";
const MAX_EVENTS = 300;

function toSafeMessage(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readEvents(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

function writeEvents(events: TelemetryEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // no-op
  }
}

export function trackTelemetry(event: Omit<TelemetryEvent, "timestamp">) {
  const payload: TelemetryEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  const events = readEvents();
  events.push(payload);
  writeEvents(events);
  // Keep console visibility for fast local debugging.
  console.debug("[telemetry]", payload);
}

export function trackUnauthorizedRouteHit(input: {
  path: string;
  action: string;
  actorRole?: string;
  isSuperAdmin?: boolean;
}) {
  trackTelemetry({
    kind: "unauthorized_route_hit",
    path: input.path,
    action: input.action,
    actorRole: input.actorRole,
    isSuperAdmin: input.isSuperAdmin,
  });
}

export function trackSuperAdminApiFailure(input: {
  endpoint: string;
  action: string;
  error: unknown;
  status?: number;
  context?: Record<string, unknown>;
}) {
  trackTelemetry({
    kind: "super_admin_api_failure",
    endpoint: input.endpoint,
    action: input.action,
    status: input.status,
    message: toSafeMessage(input.error),
    context: input.context,
  });
}

export async function measureActionLatency<T>(
  action: string,
  run: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await run();
    trackTelemetry({
      kind: "action_latency",
      action,
      latencyMs: Math.round(performance.now() - startedAt),
      success: true,
      context,
    });
    return result;
  } catch (error) {
    trackTelemetry({
      kind: "action_latency",
      action,
      latencyMs: Math.round(performance.now() - startedAt),
      success: false,
      message: toSafeMessage(error),
      context,
    });
    throw error;
  }
}

export function getTelemetryEvents(): TelemetryEvent[] {
  return readEvents();
}

