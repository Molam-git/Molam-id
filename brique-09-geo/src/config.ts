// Configuration for Geo service
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
  port: parseInt(getEnv("PORT", "3009")),
  serviceName: "id-geo",

  // Database
  pg: {
    connectionString: getEnv("DATABASE_URL"),
    ssl: getEnv("NODE_ENV") === "production",
  },

  // Redis
  redis: {
    url: getEnv("REDIS_URL", "redis://localhost:6379"),
    ttl: 3600, // 1 hour cache for geo data
  },

  // JWT
  jwtPublicKey: getEnv("JWT_PUBLIC_KEY").replace(/\\n/g, "\n"),
  jwtAudience: getEnv("JWT_AUDIENCE", "molam-id"),
  jwtIssuer: getEnv("JWT_ISSUER", "https://id.molam.com"),

  // KMS
  kms: {
    region: getEnv("AWS_REGION", "eu-west-3"),
    keyId: getEnv("KMS_KEY_ID"),
  },

  // MaxMind GeoIP
  maxmind: {
    accountId: getEnv("MAXMIND_ACCOUNT_ID", ""),
    licenseKey: getEnv("MAXMIND_LICENSE_KEY", ""),
    dbPath: getEnv("MAXMIND_DB_PATH", "/data/GeoLite2-City.mmdb"),
    asnDbPath: getEnv("MAXMIND_ASN_DB_PATH", "/data/GeoLite2-ASN.mmdb"),
  },

  // Privacy settings
  privacy: {
    defaultPrecision: "city" as const,
    gpsMaxTtlMinutes: 1440, // 24 hours
    geohashPrecision: 6, // ~1.2km precision
  },

  // Fraud detection
  fraud: {
    impossibleTravelSpeedKmh: 800, // Speed threshold for impossible travel
    countryMismatchRisk: 50, // Risk score for country mismatch
    vpnDetectedRisk: 30, // Risk score for VPN detection
  },

  // USSD
  ussd: {
    secret: getEnv("USSD_WEBHOOK_SECRET", ""),
  },

  // Audit
  audit: {
    serviceUrl: getEnv("AUDIT_SERVICE_URL", "http://id-audit:3006"),
  },
};
