// Configuration for Delegation service
import dotenv from "dotenv";
dotenv.config();

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const config = {
  // Service
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: parseInt(getEnv("PORT", "3012")),
  serviceName: "id-delegation",

  // Database
  pg: {
    connectionString: getEnv("DATABASE_URL"),
    ssl: getEnv("NODE_ENV") === "production",
  },

  // Redis (for caching active delegations)
  redis: {
    url: getEnv("REDIS_URL", "redis://localhost:6379"),
    ttl: 300, // 5 minutes cache for active delegations
  },

  // JWT
  jwtPublicKey: getEnv("JWT_PUBLIC_KEY").replace(/\\n/g, "\n"),
  jwtAudience: getEnv("JWT_AUDIENCE", "molam-id"),
  jwtIssuer: getEnv("JWT_ISSUER", "https://id.molam.com"),

  // Delegation limits
  delegation: {
    maxDurationHours: 720, // 30 days max
    defaultDurationHours: 24,
    autoExpireCheckMinutes: 5, // Check for expired delegations every 5 min
  },

  // Modules supported
  modules: ["pay", "eats", "shop", "ads", "talk", "free", "admin"],

  // Audit
  audit: {
    serviceUrl: getEnv("AUDIT_SERVICE_URL", "http://id-audit:3006"),
  },
};
