/**
 * Brique 20: RBAC Granular Server
 * Main entry point
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import { initPg, healthCheck } from "./util/pg";
import { initRedis, healthCheckRedis } from "./util/cache";
import { requestIdMiddleware } from "./util/auth";
import rbacRoutes from "./routes/rbac";

const app = express();
const PORT = parseInt(process.env.PORT || "3020");

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
app.use(rbacRoutes);

/**
 * Error handlers
 */
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: "NotFoundError",
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(
      JSON.stringify({
        level: "error",
        message: err.message,
        stack: err.stack,
        request_id: req.requestId,
      })
    );

    res.status(500).json({
      error: "InternalServerError",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    });
  }
);

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
          service: "id-rbac-granular",
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
