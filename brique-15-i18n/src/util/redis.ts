// Redis utility
import { createClient } from "redis";
import { config } from "../i18n/config";

const client = createClient({ url: config.redis.url });
client.on("error", (err) => console.error("Redis error:", err));
client.on("connect", () => console.log("✅ Redis connected"));

(async () => {
  try {
    await client.connect();
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
  }
})();

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const fullKey = config.redis.keyPrefix + key;
    const value = await client.get(fullKey);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  try {
    const fullKey = config.redis.keyPrefix + key;
    const ttl = ttlSeconds || config.redis.ttl;
    await client.setEx(fullKey, ttl, JSON.stringify(value));
  } catch (error) {
    console.error(`Redis SET error for key ${key}:`, error);
  }
}

export { client };
