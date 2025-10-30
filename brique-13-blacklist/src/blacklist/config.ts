// Brique 13: Blacklist & Suspensions - Configuration

export const config = {
  serviceName: "id-blacklist",
  port: parseInt(process.env.PORT || "3013", 10),
  env: process.env.NODE_ENV || "development",

  // Database
  database: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/molam_id",
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
    },
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    ttl: 300, // 5 minutes cache
    keyPrefix: "id:blacklist:",
  },

  // JWT
  jwt: {
    publicKey: process.env.JWT_PUBLIC_KEY || "",
    audience: process.env.JWT_AUDIENCE || "molam-id",
    issuer: process.env.JWT_ISSUER || "https://id.molam.com",
  },

  // Audit Service
  audit: {
    serviceUrl: process.env.AUDIT_SERVICE_URL || "http://id-audit:3006",
    enabled: process.env.AUDIT_ENABLED !== "false",
  },

  // SIRA (Risk Analysis) Integration
  sira: {
    serviceUrl: process.env.SIRA_SERVICE_URL || "http://sira:8080",
    enabled: process.env.SIRA_ENABLED !== "false",
  },

  // Blacklist settings
  blacklist: {
    maxPermanentBans: 1000000, // Limite théorique
    autoExpireCheckMinutes: 5, // Vérifier toutes les 5 minutes
    defaultTempDurationHours: 24, // Par défaut 24h pour suspensions temporaires
    maxTempDurationDays: 365, // Max 1 an pour suspensions temporaires
  },

  // Scopes requis
  scopes: {
    add: "id:blacklist:add",
    revoke: "id:blacklist:revoke",
    check: "id:blacklist:check",
    list: "id:blacklist:list",
  },

  // Modules supportés
  modules: ["pay", "eats", "shop", "travel", "energy", "logistics"] as const,
};

export type ModuleName = (typeof config.modules)[number];
