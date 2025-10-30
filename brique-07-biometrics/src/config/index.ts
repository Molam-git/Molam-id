// src/config/index.ts
export const config = {
  // JWT configuration
  jwtAudience: process.env.JWT_AUDIENCE || "molam.id",
  jwtIssuer: process.env.JWT_ISSUER || "https://id.molam.com",
  jwtPublicKey: process.env.JWT_PUBLIC_KEY || "",

  // WebAuthn configuration
  webauthn: {
    rpID: process.env.WEBAUTHN_RP_ID || "molam.com",
    rpName: process.env.WEBAUTHN_RP_NAME || "Molam",
    origin: (process.env.WEBAUTHN_ORIGINS || "https://app.molam.com,https://web.molam.com").split(','),
    timeout: parseInt(process.env.WEBAUTHN_TIMEOUT || "60000", 10),
  },

  // Database
  pg: {
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/molam_id",
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  // Server
  port: parseInt(process.env.PORT || "8080", 10),

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10), // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX || "60", 10), // 60 req/min
  },

  // SIRA integration
  sira: {
    enabled: process.env.SIRA_ENABLED === "true",
    streamName: process.env.SIRA_STREAM_NAME || "sira_signals",
  },

  // Metrics
  metrics: {
    enabled: process.env.METRICS_ENABLED !== "false",
  },
};
