import express from "express";
import cors from "cors";
import { createServer } from "http";
import { AppConfig } from "./config/env.js";
import { errorHandler } from "./middleware/auth.js";
import { requestMetricsMiddleware, startRequestMetricsReporter } from "./middleware/requestMetrics.js";
import equipmentRoutes from "./routes/equipment.routes.js";
import authRoutes from "./routes/auth.routes.js";
import requestRoutes from "./routes/requests.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import {
  createSocketIOServer,
  setupSocketAuth,
  setupEventHandlers,
} from "./realtime/index.js";

/**
 * Create and configure the Express app.
 * NOTE: Does NOT start the server. Call listen() separately.
 */
export function createApp(config: AppConfig): express.Application {
  const app = express();

  // ============ CORS CONFIGURATION ============
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

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl or server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || isLocalDevOrigin(origin) || isLanDevOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS not allowed for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  // ============ MIDDLEWARE ============
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  startRequestMetricsReporter();
  app.use(requestMetricsMiddleware);

  // ============ ROUTES ============
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
  });

  app.use("/api/equipment", equipmentRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/requests", requestRoutes);
  app.use("/api/chat", chatRoutes);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  // ============ ERROR HANDLING (must be last) ============
  app.use(errorHandler);

  return app;
}

/**
 * Start the server with HTTP and Socket.io support.
 */
export function startServer(app: express.Application, config: AppConfig): void {
  // Create HTTP server from Express app
  const httpServer = createServer(app);

  // Setup Socket.io on HTTP server
  const io = createSocketIOServer(httpServer, config);
  setupSocketAuth(io);
  setupEventHandlers(io);

  // Start listening
  httpServer.listen(config.port, () => {
    const configuredOrigins = [config.clientUrl, ...config.clientUrls].filter(Boolean);
    console.log(`\n✓ Server running on http://localhost:${config.port}`);
    console.log(`✓ WebSocket server initialized`);
    console.log(`✓ CORS configured origins: ${configuredOrigins.join(", ") || "(none)"}\n`);
  });
}
