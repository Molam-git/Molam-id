// Brique 15: Multilingue (i18n) - Main server

import express, { Request, Response } from "express";
import { config } from "./i18n/config";
import i18nRoutes from "./i18n/i18n.routes";
import { errorHandler } from "./util/errors";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  if (!["/health", "/healthz", "/livez"].includes(req.path)) {
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
app.use("/v1/i18n", i18nRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`✅ ${config.serviceName} listening on port ${config.port}`);
  console.log(`   Environment: ${config.env}`);
  console.log(`   Default locale: ${config.i18n.defaultLocale}`);
  console.log(`   Supported locales: ${config.i18n.supportedLocales.join(", ")}`);
  console.log(`   S3 bundles: ${config.s3.enabled ? "enabled" : "disabled"}`);
  console.log(`   Signature verification: ${config.signature.enabled ? "enabled" : "disabled"}`);
});

export default app;
