/**
 * Socket.io Server Setup
 * 
 * Initializes Socket.io server with CORS and authentication.
 * Attaches to the existing Express HTTP server.
 */

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { AppConfig } from "../config/env.js";
import { REALTIME_CONFIG } from "./config.js";

/**
 * Create and configure Socket.io server.
 * Returns the configured server instance (but does NOT listen).
 */
export function createSocketIOServer(
  httpServer: HTTPServer,
  config: AppConfig
): SocketIOServer {
  // CORS origins (match Express CORS config)
  const allowedOrigins = Array.from(
    new Set([
      config.clientUrl,
      ...config.clientUrls,
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://127.0.0.1:5175",
    ])
  );

  const isLocalDevOrigin = (origin: string): boolean =>
    /^https?:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(origin);
  const isLanDevOrigin = (origin: string): boolean =>
    /^https?:\/\/((192\.168|10\.\d+|172\.(1[6-9]|2\d|3[0-1]))\.\d+\.\d+):\d{2,5}$/.test(origin);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          isLocalDevOrigin(origin) ||
          isLanDevOrigin(origin)
        ) {
          callback(null, true);
        } else {
          callback(new Error(`CORS not allowed for origin: ${origin}`));
        }
      },
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    transports: ["websocket", "polling"],
    pingInterval: REALTIME_CONFIG.socket.pingIntervalMs,
    pingTimeout: REALTIME_CONFIG.socket.pingTimeoutMs,
    maxHttpBufferSize: REALTIME_CONFIG.socket.maxHttpBufferSizeBytes,
  });

  return io;
}
