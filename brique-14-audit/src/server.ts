// Brique 14: Audit logs centralisés - Main server

import express, { Request, Response } from "express";
import { config } from "./audit/config";
import auditRoutes from "./audit/audit.routes";
import { errorHandler } from "./util/errors";
import { startAuditConsumer } from "./jobs/audit-kafka";
import { runAuditArchiveJob } from "./jobs/audit-archive";
import cron from "node-cron";

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  if (req.path !== "/health" && req.path !== "/healthz" && req.path !== "/livez") {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// Health checks
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: config.serviceName });
});

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/livez", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/v1/audit", auditRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, async () => {
  console.log(`✅ ${config.serviceName} listening on port ${config.port}`);
  console.log(`   Environment: ${config.env}`);
  console.log(`   S3 archival: ${config.s3.enabled ? "enabled" : "disabled"}`);
  console.log(`   Kafka ingestion: ${config.kafka.enabled ? "enabled" : "disabled"}`);

  // Start Kafka consumer if enabled
  if (config.kafka.enabled) {
    try {
      await startAuditConsumer();
    } catch (error) {
      console.error("Failed to start Kafka consumer:", error);
    }
  }

  // Schedule daily archive job (at 2 AM UTC by default)
  if (config.s3.enabled) {
    const [hour, minute] = config.audit.archiveDailyAt.split(":");
    const cronExpression = `${minute} ${hour} * * *`;

    cron.schedule(cronExpression, async () => {
      console.log("⏰ Running scheduled archive job...");
      try {
        await runAuditArchiveJob();
      } catch (error) {
        console.error("Archive job failed:", error);
      }
    });

    console.log(`   Archive scheduled: ${cronExpression} UTC`);
  }

  // Log startup metrics
  console.log(`   Retention: ${config.audit.retentionDays} days`);
  console.log(`   Search limit: ${config.audit.searchLimit} results`);
});

export default app;
