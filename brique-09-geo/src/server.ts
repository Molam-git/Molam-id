// Geo & Timezone Service
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import { /* authRequired, */ authOptional } from "./util/auth";
import geoRoutes from "./routes/geo";
import ussdRoutes from "./routes/ussd";
import { errorHandler } from "./util/errors";

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from Molam domains or no origin (mobile apps)
    if (!origin || /\.molam\.com$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "id-geo",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/healthz", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/livez", (_req, res) => {
  res.status(200).send("OK");
});

// Public routes (no auth, used for country detection)
app.use("/v1/geo", authOptional, geoRoutes);

// USSD routes (public, secured with webhook signature)
app.use("/v1/ussd", ussdRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "not_found",
    message: "Endpoint not found",
    path: req.path,
  });
});

// Start server
const port = config.port;

app.listen(port, () => {
  console.log(`🌍 Geo service listening on port ${port}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🔐 JWT Audience: ${config.jwtAudience}`);
  console.log(`🗄️  Database: ${config.pg.connectionString.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`🗺️  MaxMind: ${config.maxmind.dbPath}`);
});

export { app };
