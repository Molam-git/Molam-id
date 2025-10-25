// config.js - Device service configuration
export const deviceCfg = {
  pgUrl: process.env.DATABASE_URL || 'postgres://molam:molam_pass@localhost:5432/molam',
  hashPepper: process.env.DEVICE_HASH_PEPPER || 'default-pepper-change-in-production',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  attestation: {
    googleApiKey: process.env.GOOGLE_PLAY_INTEGRITY_KEY || '',
    appleTeamId: process.env.APPLE_TEAM_ID || '',
    appleKeyId: process.env.APPLE_KEY_ID || '',
    applePrivateKey: process.env.APPLE_PRIVATE_KEY || ''
  }
};
