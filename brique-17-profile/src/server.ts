import express from "express";
import { config } from "./profile/config";
import profileRoutes from "./profile/profile.routes";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: config.serviceName }));
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/livez", (_req, res) => res.json({ status: "ok" }));

app.use("/v1/profile", profileRoutes);

app.listen(config.port, () => {
  console.log(`✅ ${config.serviceName} listening on port ${config.port}`);
  console.log(`   S3 bucket: ${config.s3.bucket}`);
});

export default app;
