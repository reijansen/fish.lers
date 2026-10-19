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
import { isAllowedOrigin } from "../config/cors.js";

/**
 * Create and configure Socket.io server.
 * Returns the configured server instance (but does NOT listen).
 */
export function createSocketIOServer(
  httpServer: HTTPServer,
  config: AppConfig
): SocketIOServer {
  // CORS origins (match Express CORS config)
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          isAllowedOrigin(origin, config)
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
