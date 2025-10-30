export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://molam:molam_pass@localhost:5432/molam',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Crypto
  PEPPER: process.env.PEPPER || 'change-me-in-production-use-hsm',

  // OTP
  OTP_TTL_SECONDS: parseInt(process.env.OTP_TTL_SECONDS || '600', 10), // 10 minutes
  OTP_ATTEMPTS_PER_HOUR: parseInt(process.env.OTP_ATTEMPTS_PER_HOUR || '3', 10),
  OTP_LENGTH: parseInt(process.env.OTP_LENGTH || '6', 10),

  // Rate limiting
  RATE_LIMIT_WINDOW_S: parseInt(process.env.RATE_LIMIT_WINDOW_S || '3600', 10), // 1 hour
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),

  // JWT
  JWT_RESET_SECRET: process.env.JWT_RESET_SECRET || 'reset-secret-change-in-vault',
  JWT_RESET_TTL_S: parseInt(process.env.JWT_RESET_TTL_S || '900', 10), // 15 minutes

  // i18n
  DEFAULT_LANG: process.env.DEFAULT_LANG || 'en',

  // Service
  PORT: parseInt(process.env.PORT || '8085', 10),
  NODE_ENV: process.env.NODE_ENV || 'development'
};
