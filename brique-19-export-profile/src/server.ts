/**
 * Brique 19: Export Profile Server
 * Main entry point
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import { initPg, healthCheck } from "./util/pg";
import { initS3, healthCheckS3 } from "./util/storage";
import { requestIdMiddleware } from "./util/auth";
import exportRoutes from "./routes/export";
import { startExportWorker } from "./workers/exportWorker";

const app = express();
const PORT = parseInt(process.env.PORT || "3019");

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
  const s3Healthy = await healthCheckS3();

  const healthy = dbHealthy && s3Healthy;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy ? "ok" : "failed",
      storage: s3Healthy ? "ok" : "failed",
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
app.use(exportRoutes);

/**
 * Error handlers
 */
app.use((req, res) => {
  res.status(404).json({
    error: "NotFoundError",
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
});

/**
 * Start server
 */
async function start() {
  try {
    // Initialize database
    console.log("Initializing PostgreSQL...");
    initPg();

    // Initialize S3/MinIO
    console.log("Initializing S3/MinIO...");
    initS3();

    // Start export worker
    console.log("Starting export worker...");
    startExportWorker();

    // Start server
    app.listen(PORT, () => {
      console.log(
        JSON.stringify({
          level: "info",
          message: "Server started",
          port: PORT,
          service: "id-export-profile",
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
