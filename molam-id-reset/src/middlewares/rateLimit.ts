import type { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

redis.connect();

export function slidingWindowLimit(prefix: string, windowSec: number, max: number, keyFromReq: (req: Request) => string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const key = `${prefix}:${keyFromReq(req)}`;
        const now = Date.now();
        const multi = redis.multi();
        multi.zRemRangeByScore(key, 0, now - windowSec * 1000);
        multi.zAdd(key, [{ score: now, value: `${now}:${Math.random()}` }]);
        multi.zCard(key);
        multi.expire(key, windowSec);
        const [, , count] = await multi.exec() as any;
        if (count > max) return res.status(429).json({ error: 'RATE_LIMITED' });
        next();
    };
}
