/**
 * Brique 18: API Update Profile Server
 * Main entry point
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import { initPg, healthCheck } from "./util/pg";
import { initRedis, healthCheckRedis } from "./util/redis";
import { requestIdMiddleware } from "./util/auth";
import { errorHandler, notFoundHandler } from "./util/errors";
import prefsRoutes from "./routes/prefs";
import contactsRoutes from "./routes/contacts";

const app = express();
const PORT = parseInt(process.env.PORT || "3018");

/**
 * Middleware
 */
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

// Request logging
app.use((req, res, next) => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "HTTP request received",
      method: req.method,
      path: req.path,
      request_id: req.requestId,
    })
  );
  next();
});

/**
 * Health check endpoints
 */
app.get("/healthz", async (req, res) => {
  const dbHealthy = await healthCheck();
  const redisHealthy = await healthCheckRedis();

  const healthy = dbHealthy && redisHealthy;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy ? "ok" : "failed",
      redis: redisHealthy ? "ok" : "failed",
    },
  });
});

app.get("/livez", (req, res) => {
  res.json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Routes
 */
app.use(prefsRoutes);
app.use(contactsRoutes);

/**
 * Error handlers
 */
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Start server
 */
async function start() {
  try {
    // Initialize database
    console.log("Initializing PostgreSQL...");
    initPg();

    // Initialize Redis
    console.log("Initializing Redis...");
    await initRedis();

    // Start server
    app.listen(PORT, () => {
      console.log(
        JSON.stringify({
          level: "info",
          message: "Server started",
          port: PORT,
          service: "id-update-profile",
          version: "1.0.0",
        })
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

// Start the server
start();

export default app;
