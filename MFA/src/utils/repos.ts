import { Pool } from 'pg';
import Redis from 'ioredis';
import { cfg } from '../config/index.js';

export const pool = new Pool({
    connectionString: cfg.pgUrl,
    ssl: cfg.nodeEnv === 'production' ? { rejectUnauthorized: false } : false
});

export const redis = new Redis(cfg.redisUrl);

// Gestion propre de la fermeture
process.on('SIGINT', async () => {
    await pool.end();
    await redis.quit();
    process.exit(0);
});