// src/config/env.ts
export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/molam_id',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Crypto
  PEPPER: process.env.PEPPER || 'use-hsm-key-ref-in-production',

  // OTP settings
  OTP_TTL_SECONDS: parseInt(process.env.OTP_TTL_SECONDS || '600', 10), // 10 min
  OTP_LENGTH: parseInt(process.env.OTP_LENGTH || '6', 10),
  OTP_ATTEMPTS_PER_HOUR: parseInt(process.env.OTP_ATTEMPTS_PER_HOUR || '3', 10),
  MAX_ATTEMPTS: parseInt(process.env.MAX_ATTEMPTS || '3', 10),

  // Rate limiting
  RATE_LIMIT_WINDOW_S: parseInt(process.env.RATE_LIMIT_WINDOW_S || '3600', 10), // 1 hour
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),

  // JWT
  JWT_RESET_SECRET: process.env.JWT_RESET_SECRET || 'rotated-in-vault-production',
  JWT_RESET_TTL_S: parseInt(process.env.JWT_RESET_TTL_S || '900', 10), // 15 min

  // i18n
  DEFAULT_LANG: process.env.DEFAULT_LANG || 'en',

  // Server
  PORT: parseInt(process.env.PORT || '8085', 10),

  // Kafka (optional)
  KAFKA_ENABLED: process.env.KAFKA_ENABLED === 'true',
  KAFKA_BROKERS: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'molam-id-password-reset',

  // RabbitMQ/AMQP (optional)
  AMQP_ENABLED: process.env.AMQP_ENABLED === 'true',
  AMQP_URL: process.env.AMQP_URL || 'amqp://localhost:5672',

  // SIRA (risk analysis)
  SIRA_ENABLED: process.env.SIRA_ENABLED === 'true',
  SIRA_WEBHOOK_URL: process.env.SIRA_WEBHOOK_URL || '',
  SIRA_THRESHOLD_OTP_FAILURE_RATE: parseFloat(process.env.SIRA_THRESHOLD_OTP_FAILURE_RATE || '0.4'), // 40%

  // Metrics
  METRICS_ENABLED: process.env.METRICS_ENABLED !== 'false', // enabled by default
};
