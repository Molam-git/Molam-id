// config.js - MFA service configuration
export const cfg = {
  pgUrl: process.env.DATABASE_URL || 'postgres://molam:molam_pass@localhost:5432/molam',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  otpTtlSec: parseInt(process.env.OTP_TTL_SEC || '180'), // 3 minutes
  otpLength: parseInt(process.env.OTP_LENGTH || '6'),
  maxOtpAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS || '5'),
  totp: {
    step: 30,
    digits: 6,
    algo: 'SHA1'
  },
  recoveryCodesCount: parseInt(process.env.RECOVERY_COUNT || '10'),
  hmacWebhookSecret: process.env.WEBHOOK_HMAC_SECRET || '',
  kmsKeyId: process.env.KMS_KEY_ID || '',
  localEncKey: (process.env.LOCAL_ENC_KEY || '').padEnd(32, '0').slice(0, 32)
};
