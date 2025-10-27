import { config } from 'dotenv';
config();

export const cfg = {
    // Server
    port: parseInt(process.env.PORT || '8084'),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    pgUrl: process.env.DATABASE_URL!,

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // JWT
    jwtPubKey: process.env.JWT_PUBLIC_KEY!,

    // OTP Configuration
    otpTtlSec: parseInt(process.env.OTP_TTL || '180'),
    otpLength: parseInt(process.env.OTP_LENGTH || '6'),
    maxOtpAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS || '5'),

    // Argon2
    argon: {
        timeCost: parseInt(process.env.ARGON_TIME_COST || '3'),
        memoryCost: parseInt(process.env.ARGON_MEMORY_COST || '19456'),
        parallelism: parseInt(process.env.ARGON_PARALLELISM || '1')
    },

    // TOTP (RFC6238)
    totp: {
        step: parseInt(process.env.TOTP_STEP || '30'),
        digits: parseInt(process.env.TOTP_DIGITS || '6'),
        algo: process.env.TOTP_ALGO || 'SHA1'
    },

    // Recovery Codes
    recoveryCodesCount: parseInt(process.env.RECOVERY_CODES_COUNT || '10'),

    // Security
    hmacWebhookSecret: process.env.WEBHOOK_HMAC_SECRET || '',
    kmsKeyId: process.env.KMS_KEY_ID || '',

    // WebAuthn
    rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME || 'Molam',
    rpOrigin: process.env.WEBAUTHN_RP_ORIGIN || 'http://localhost:3000'
};

// Validation des variables requises
const required = ['DATABASE_URL', 'JWT_PUBLIC_KEY'];
for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Variable d'environnement manquante: ${key}`);
    }
}