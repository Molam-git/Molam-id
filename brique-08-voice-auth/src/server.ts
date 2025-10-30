// Voice Authentication Service
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import { authOptional } from "./util/auth";
import voiceRoutes from "./routes/voice";
import ivrRoutes from "./routes/ivr";
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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "voice-auth",
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

// Protected routes (require JWT)
app.use("/v1/voice", authOptional, voiceRoutes);

// IVR routes (public, secured with webhook signature)
app.use("/v1/ivr", ivrRoutes);

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
  console.log(`🎤 Voice Auth service listening on port ${port}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🔐 JWT Audience: ${config.jwtAudience}`);
  console.log(`🗄️  Database: ${config.pg.connectionString.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`📦 S3 Bucket: ${config.s3.bucketTemp}`);
  console.log(`🤖 Voice ML: ${config.voiceML.url}`);
});

export { app };
