import { Redis } from 'ioredis';
import { redis } from '../utils/repos.js';

export class RateLimitService {
    static async check(
        key: string,
        limit: number,
        windowSec: number
    ): Promise<{ allowed: boolean; remaining: number }> {
        const now = Date.now();
        const windowStart = Math.floor(now / 1000 / windowSec);
        const redisKey = `rl:${key}:${windowStart}`;

        const count = await redis.incr(redisKey);
        if (count === 1) {
            await redis.expire(redisKey, windowSec);
        }

        return {
            allowed: count <= limit,
            remaining: Math.max(0, limit - count)
        };
    }

    static async checkUserLimit(
        userId: string,
        action: string,
        limit: number,
        windowSec: number
    ): Promise<boolean> {
        const result = await this.check(`user:${userId}:${action}`, limit, windowSec);
        return result.allowed;
    }

    static async checkIpLimit(
        ip: string,
        action: string,
        limit: number,
        windowSec: number
    ): Promise<boolean> {
        const result = await this.check(`ip:${ip}:${action}`, limit, windowSec);
        return result.allowed;
    }
}