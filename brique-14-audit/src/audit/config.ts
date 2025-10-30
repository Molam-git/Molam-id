// Brique 14: Audit logs centralisés - Configuration

export const config = {
  serviceName: "id-audit",
  port: parseInt(process.env.PORT || "3014", 10),
  env: process.env.NODE_ENV || "development",

  // Database
  database: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/molam_id",
    pool: {
      min: 5,
      max: 20,
      idleTimeoutMillis: 30000,
    },
  },

  // Redis (cache for read-heavy queries)
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    ttl: 60, // 1 minute cache for search results
    keyPrefix: "id:audit:",
  },

  // JWT (mTLS + Service JWT for ingestion)
  jwt: {
    publicKey: process.env.JWT_PUBLIC_KEY || "",
    audience: process.env.JWT_AUDIENCE || "molam-id",
    issuer: process.env.JWT_ISSUER || "https://id.molam.com",
  },

  // S3 (archivage WORM)
  s3: {
    region: process.env.S3_REGION || "eu-west-1",
    bucket: process.env.S3_AUDIT_BUCKET || "molam-audit-logs",
    kmsKeyId: process.env.S3_KMS_KEY_ID || "",
    enabled: process.env.S3_ENABLED !== "false",
  },

  // Kafka (optionnel haute charge)
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    topic: process.env.KAFKA_AUDIT_TOPIC || "molam.audit",
    groupId: process.env.KAFKA_GROUP_ID || "audit-ingestion",
    enabled: process.env.KAFKA_ENABLED === "true",
  },

  // Audit settings
  audit: {
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || "395", 10), // 13 months
    archiveDailyAt: process.env.ARCHIVE_DAILY_AT || "02:00", // 2 AM UTC
    searchLimit: 500, // Max results per search query
    chainVerifyEnabled: process.env.CHAIN_VERIFY_ENABLED !== "false",
  },

  // Scopes requis
  scopes: {
    append: "audit:append",
    search: "audit:search",
    export: "audit:export",
  },

  // Roles autorisés pour la recherche
  allowedRoles: ["auditor", "compliance_officer", "ciso", "cto", "legal"],

  // Modules supportés
  modules: [
    "id",
    "pay",
    "eats",
    "talk",
    "ads",
    "shop",
    "free",
    "logistics",
    "energy",
    "travel",
  ] as const,
};

export type ModuleName = (typeof config.modules)[number];
export type ActorType = "user" | "employee" | "service";
export type AuditResult = "allow" | "deny" | "success" | "failure";
