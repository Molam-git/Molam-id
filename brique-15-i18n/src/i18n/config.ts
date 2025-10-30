// Brique 15: Multilingue (i18n) - Configuration

export const config = {
  serviceName: "id-i18n",
  port: parseInt(process.env.PORT || "3015", 10),
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

  // Redis (cache for translations)
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    ttl: 3600, // 1 hour cache
    keyPrefix: "id:i18n:",
  },

  // JWT
  jwt: {
    publicKey: process.env.JWT_PUBLIC_KEY || "",
    audience: process.env.JWT_AUDIENCE || "molam-id",
    issuer: process.env.JWT_ISSUER || "https://id.molam.com",
  },

  // S3 (CDN bundles)
  s3: {
    region: process.env.S3_REGION || "eu-west-1",
    bucket: process.env.I18N_BUCKET || "molam-i18n-bundles",
    kmsKeyId: process.env.S3_KMS_KEY_ID || "",
    enabled: process.env.S3_ENABLED !== "false",
  },

  // Ed25519 signature keys
  signature: {
    privateKey: process.env.I18N_SIGN_PRIV || "",
    publicKey: process.env.I18N_SIGN_PUB || "",
    enabled: process.env.SIGNATURE_ENABLED !== "false",
  },

  // i18n settings
  i18n: {
    defaultLocale: "en",
    fallbackLocale: "en",
    supportedLocales: ["en", "fr", "fr-SN", "ar", "he", "wol", "pt", "es"],
    ussdMaxLength: 182,
    smsMaxLength: 160,
  },

  // Scopes requis
  scopes: {
    resolve: "i18n:resolve",
    edit: "i18n:edit",
    review: "i18n:review",
    publish: "i18n:publish",
  },

  // Roles autorisés
  allowedRoles: {
    editor: ["i18n_editor", "superadmin"],
    reviewer: ["i18n_reviewer", "superadmin"],
    auditor: ["auditor", "compliance_officer", "superadmin"],
  },

  // Modules supportés
  modules: [
    "id",
    "pay",
    "eats",
    "talk",
    "ads",
    "shop",
    "free",
    "shared",
  ] as const,

  // Channels supportés
  channels: ["app", "web", "ussd", "sms", "dashboard"] as const,
};

export type ModuleName = (typeof config.modules)[number];
export type ChannelType = (typeof config.channels)[number];
