// Simple Redis pub/sub (or Kafka) producer stub
import { createClient } from "redis";

const client = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});

// Connect on module load
client.connect().catch((err) => {
    console.error("Redis connection error:", err);
});

export async function publishEvent(topic: string, payload: any) {
    try {
        await client.publish(topic, JSON.stringify(payload));
    } catch (err) {
        console.error("Failed to publish event:", err);
        // In production, you might want to use a fallback or retry mechanism
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    await client.quit();
});