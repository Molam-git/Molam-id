// Delegation Service
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./delegation/config";
import delegationRoutes from "./delegation/routes";
import { errorHandler } from "./util/errors";
import { query } from "./util/pg";

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

// Health checks
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "id-delegation",
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

// Routes
app.use("/v1/delegations", delegationRoutes);

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

// Start auto-expiration job
setInterval(async () => {
  try {
    const result = await query("SELECT expire_delegations()");
    const expired = result[0]?.expire_delegations || 0;
    if (expired > 0) {
      console.log(`✅ Expired ${expired} delegation(s)`);
    }
  } catch (error) {
    console.error("Failed to expire delegations:", error);
  }
}, config.delegation.autoExpireCheckMinutes * 60 * 1000);

// Start server
const port = config.port;

app.listen(port, () => {
  console.log(`🔐 Delegation service listening on port ${port}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🔐 JWT Audience: ${config.jwtAudience}`);
  console.log(`🗄️  Database: ${config.pg.connectionString.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`⏰ Auto-expire check: every ${config.delegation.autoExpireCheckMinutes} minutes`);
});

export { app };
