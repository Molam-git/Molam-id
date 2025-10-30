// src/server.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { authJWT } from "./util/auth.js";
import { rateLimiter } from "./util/rate.js";
import { errorHandler } from "./util/errors.js";
import biometricsRouter from "./routes/biometrics.js";
import { testConnection } from "./util/pg.js";
import { connectRedis } from "./util/redis.js";
import { config } from "./config/index.js";
import client from "prom-client";

const app = express();

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

// Security middleware
app.use(helmet());

// CORS - only allow Molam domains
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /molam\.com$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
}));

// Body parsing
app.use(express.json({ limit: "1mb" }));

// Request duration tracking
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status: res.statusCode.toString(),
      },
      duration
    );
  });

  next();
});

// Health check (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "molam-biometrics",
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint (no auth required, but should be behind firewall)
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// All other routes require authentication
app.use(authJWT);

// Rate limiting (after auth to use user ID)
app.use(rateLimiter);

// Biometrics routes
app.use("/v1/biometrics", biometricsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Test database connection
    await testConnection();

    // Connect to Redis
    await connectRedis();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      console.log("");
      console.log("🔐 Molam ID - Biometrics Service (WebAuthn/Passkeys)");
      console.log(`📍 Port: ${config.port}`);
      console.log(`🌍 Platforms: Web, iOS, Android, HarmonyOS, Desktop`);
      console.log(`🔒 Security: WebAuthn, JWT, mTLS, rate limiting`);
      console.log(`📊 Metrics: http://localhost:${config.port}/metrics`);
      console.log(`❤️  Health: http://localhost:${config.port}/health`);
      console.log("");
      console.log("Endpoints:");
      console.log("  POST /v1/biometrics/enroll/begin");
      console.log("  POST /v1/biometrics/enroll/finish");
      console.log("  POST /v1/biometrics/assert/begin");
      console.log("  POST /v1/biometrics/assert/finish");
      console.log("  GET  /v1/biometrics/prefs");
      console.log("  PATCH /v1/biometrics/prefs");
      console.log("  GET  /v1/biometrics/devices");
      console.log("  DELETE /v1/biometrics/credentials/:id");
      console.log("  DELETE /v1/biometrics/devices/:id");
      console.log("");
      console.log(`WebAuthn RP ID: ${config.webauthn.rpID}`);
      console.log(`WebAuthn RP Name: ${config.webauthn.rpName}`);
      console.log(`Allowed Origins: ${config.webauthn.origin.join(", ")}`);
      console.log("");
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\n⏳ Shutting down gracefully...");

      server.close(() => {
        console.log("✓ HTTP server closed");
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error("❌ Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
