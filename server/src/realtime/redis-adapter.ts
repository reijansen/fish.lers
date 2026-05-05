import type { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

export interface RedisAdapterStatus {
  enabled: boolean;
  mode: "disabled" | "enabled" | "failed";
  details?: string;
}

function resolveRedisUrl(): string | null {
  if (process.env.REDIS_URL && process.env.REDIS_URL.trim()) return process.env.REDIS_URL.trim();

  const host = process.env.REDIS_HOST?.trim();
  const port = process.env.REDIS_PORT?.trim();
  if (!host) return null;
  return `redis://${host}:${port || "6379"}`;
}

/**
 * Optionally enable Redis adapter for multi-instance Socket.IO.
 *
 * Behavior:
 * - If no Redis env vars are set -> disabled (no-op).
 * - If Redis is configured but connection fails -> logs warning and continues without adapter.
 */
export async function maybeEnableRedisAdapter(io: SocketIOServer): Promise<RedisAdapterStatus> {
  const url = resolveRedisUrl();
  if (!url) return { enabled: false, mode: "disabled", details: "REDIS_URL/REDIS_HOST not set" };

  try {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err: unknown) =>
      console.warn("[Redis] pubClient error:", (err as any)?.message || err)
    );
    subClient.on("error", (err: unknown) =>
      console.warn("[Redis] subClient error:", (err as any)?.message || err)
    );

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));

    // Close on shutdown
    const cleanup = async () => {
      try {
        await Promise.allSettled([pubClient.quit(), subClient.quit()]);
      } catch {
        // ignore
      }
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    return { enabled: true, mode: "enabled", details: url };
  } catch (err: any) {
    return { enabled: false, mode: "failed", details: err?.message || "Redis adapter setup failed" };
  }
}
