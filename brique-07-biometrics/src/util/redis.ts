// src/util/redis.ts
import { createClient } from "redis";
import { config } from "../config/index.js";

export const redis = createClient({ url: config.redis.url });

redis.on("error", (err) => console.error("Redis error:", err));
redis.on("connect", () => console.log("✓ Redis connected"));

let isConnected = false;

export async function connectRedis() {
  if (!isConnected) {
    await redis.connect();
    isConnected = true;
  }
  return redis;
}
