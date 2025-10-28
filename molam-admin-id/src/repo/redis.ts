// src/repo/redis.ts (stub)
// In production, use actual Redis client

const cache = new Map<string, { value: any; expires: number }>();

export const redis = {
    del: async (key: string): Promise<void> => {
        console.log(`[Redis] DEL ${key}`);
        cache.delete(key);
    },

    set: async (key: string, value: any, options: { EX?: number } = {}): Promise<void> => {
        const expires = options.EX ? Date.now() + options.EX * 1000 : 0;
        cache.set(key, { value, expires });
        console.log(`[Redis] SET ${key}`, { EX: options.EX });
    },

    get: async (key: string): Promise<any> => {
        const item = cache.get(key);
        if (item && (item.expires === 0 || item.expires > Date.now())) {
            console.log(`[Redis] GET ${key} - HIT`);
            return item.value;
        }

        if (item) {
            cache.delete(key); // Clean up expired entries
        }

        console.log(`[Redis] GET ${key} - MISS`);
        return null;
    }
};