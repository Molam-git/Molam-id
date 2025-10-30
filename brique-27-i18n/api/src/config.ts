// api/src/config.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/molam_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const config = {
  port: process.env.PORT || 3000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  supportedLanguages: ['fr', 'en', 'wo', 'ar', 'es'] as const,
  defaultLanguage: 'en' as const,
  cacheVersion: process.env.CACHE_VERSION || '1.0.0',
  enableMetrics: process.env.ENABLE_METRICS === 'true',
};

export default config;
