/**
 * Realtime Chat Configuration
 *
 * Centralized env-based configuration for socket events.
 * Keep defaults safe for MVP usage.
 */

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const REALTIME_CONFIG = {
  socket: {
    // Socket.IO server options
    pingIntervalMs: readInt("SOCKET_PING_INTERVAL_MS", 25_000),
    pingTimeoutMs: readInt("SOCKET_PING_TIMEOUT_MS", 20_000),
    maxHttpBufferSizeBytes: readInt("SOCKET_MAX_HTTP_BUFFER_BYTES", 1_000_000), // 1MB
  },
  message: {
    maxLength: readInt("CHAT_MAX_MESSAGE_LENGTH", 2000),
    rateMax: readInt("CHAT_RATE_MESSAGE_MAX", 10),
    rateWindowMs: readInt("CHAT_RATE_MESSAGE_WINDOW_MS", 10_000),
  },
  typing: {
    rateMax: readInt("CHAT_RATE_TYPING_MAX", 30),
    rateWindowMs: readInt("CHAT_RATE_TYPING_WINDOW_MS", 10_000),
  },
  read: {
    rateMax: readInt("CHAT_RATE_READ_MAX", 60),
    rateWindowMs: readInt("CHAT_RATE_READ_WINDOW_MS", 10_000),
  },
} as const;
