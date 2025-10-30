// Configuration for Voice Auth service
export const config = {
  // JWT settings
  jwtAudience: process.env.JWT_AUDIENCE || "molam.id",
  jwtIssuer: process.env.JWT_ISSUER || "https://id.molam.com",
  jwtPublicKey: process.env.JWT_PUBLIC_KEY || "",

  // KMS/Encryption
  kmsKeyId: process.env.KMS_KEY_ID || "",
  dataEncKey: process.env.DATA_ENC_KEY || "",

  // S3 temp storage for audio (ephemeral, <24h lifecycle)
  s3: {
    bucketTemp: process.env.S3_TEMP_BUCKET || "molam-voice-temp",
    region: process.env.AWS_REGION || "eu-west-1",
  },

  // Audio limits
  web: {
    maxAudioSec: parseInt(process.env.MAX_AUDIO_SEC || "15", 10),
    maxAudioBytes: parseInt(process.env.MAX_AUDIO_BYTES || "4000000", 10), // 4MB
  },

  // Voice ML microservice
  voiceML: {
    url: process.env.VOICE_ML_URL || "http://voice-ml:9000",
    timeout: parseInt(process.env.VOICE_ML_TIMEOUT || "5000", 10),
  },

  // PostgreSQL
  pg: {
    connectionString: process.env.DATABASE_URL || "postgresql://molam:molam_pass@localhost:5432/molam_id",
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  // IVR webhook (Twilio, Infobip, Africa's Talking)
  ivr: {
    webhookSecret: process.env.IVR_WEBHOOK_SECRET || "",
  },

  // SIRA integration
  sira: {
    enabled: process.env.SIRA_ENABLED === "true",
    streamName: process.env.SIRA_STREAM_NAME || "sira_signals",
  },

  // Server
  port: parseInt(process.env.PORT || "8081", 10),
  nodeEnv: process.env.NODE_ENV || "development",
};
