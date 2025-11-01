/**
 * Event bus for publishing session-related events
 * Uses Redis pub/sub (can be extended to Kafka)
 */
import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;

export async function initEventBus() {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not set, event publishing disabled');
    return;
  }

  try {
    client = createClient({ url: process.env.REDIS_URL });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await client.connect();
    console.log('✅ Event bus (Redis) connected');
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
  }
}

export async function publishEvent(topic: string, payload: any) {
  if (!client || !client.isOpen) {
    console.warn(`⚠️  Event not published (Redis not connected): ${topic}`);
    return;
  }

  try {
    const message = JSON.stringify({
      topic,
      payload,
      timestamp: new Date().toISOString()
    });

    await client.publish(topic, message);
    console.log(`📤 Event published: ${topic}`);
  } catch (error) {
    console.error(`❌ Failed to publish event ${topic}:`, error);
  }
}

export async function closeEventBus() {
  if (client && client.isOpen) {
    await client.quit();
    console.log('Event bus closed');
  }
}
