// Brique 13: Blacklist & Suspensions - Main server

import express, { Request, Response } from "express";
import { config } from "./blacklist/config";
import blacklistRoutes from "./blacklist/routes";
import { errorHandler } from "./util/errors";
import { query } from "./util/pg";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
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
app.use("/v1/blacklist", blacklistRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`✅ ${config.serviceName} listening on port ${config.port}`);
  console.log(`   Environment: ${config.env}`);
  console.log(`   Audit: ${config.audit.enabled ? "enabled" : "disabled"}`);
  console.log(`   SIRA: ${config.sira.enabled ? "enabled" : "disabled"}`);

  // Start auto-expiration job
  setInterval(
    async () => {
      try {
        const result = await query<{ expire_suspensions: number }>(
          "SELECT expire_suspensions()"
        );
        const expired = result[0]?.expire_suspensions || 0;
        if (expired > 0) {
          console.log(`✅ Expired ${expired} suspension(s)`);
        }
      } catch (error) {
        console.error("Error in auto-expiration job:", error);
      }
    },
    config.blacklist.autoExpireCheckMinutes * 60 * 1000
  );
});

export default app;
